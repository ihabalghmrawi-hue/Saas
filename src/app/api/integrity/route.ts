/**
 * Financial Integrity Check
 *
 * Verifies:
 * 1. Wallet balance = sum(income transactions) - sum(expense transactions)
 * 2. Every sale has a corresponding journal entry
 * 3. Every purchase has a corresponding journal entry
 * 4. Journal entries are balanced (sum debits = sum credits)
 *
 * Logs all inconsistencies to audit_logs with severity='critical'.
 * Scheduled daily via vercel.json cron.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface IntegrityIssue {
  type:        string
  severity:    'warning' | 'critical'
  description: string
  entity_id?:  string
  expected?:   number
  actual?:     number
  diff?:       number
}

export async function GET(req: NextRequest) {
  // Allow cron (no auth header) or internal calls
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 })
  }

  const supabase   = createClient()
  const issues: IntegrityIssue[] = []
  const COMPANY_ID = getCompanyId()

  // ── 1. Wallet balance integrity ────────────────────────────────────────────
  const { data: wallets } = await supabase
    .from('wallets')
    .select('id, name, balance')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)

  for (const wallet of wallets || []) {
    const { data: txns } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('wallet_id', wallet.id)
      .eq('status', 'completed')

    // Only check wallets that have transaction records — wallets with no
    // transactions may have a manual opening balance which is intentional.
    if (!txns || txns.length === 0) continue

    const expectedBalance = txns.reduce((sum, t) => {
      return sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount))
    }, 0)

    const actualBalance = Number(wallet.balance || 0)
    const diff = Math.abs(actualBalance - expectedBalance)

    if (diff > 0.01) {
      issues.push({
        type:        'wallet_balance_mismatch',
        severity:    diff > 100 ? 'critical' : 'warning',
        description: `رصيد الصندوق "${wallet.name}" غير متطابق`,
        entity_id:   wallet.id,
        expected:    expectedBalance,
        actual:      actualBalance,
        diff,
      })
    }
  }

  // ── 2. Sales missing journal entries ──────────────────────────────────────
  const { data: recentSales } = await supabase
    .from('sales')
    .select('id, invoice_number, total')
    .eq('company_id', COMPANY_ID)
    .eq('status', 'completed')
    .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())

  for (const sale of recentSales || []) {
    const { data: journalEntry } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', COMPANY_ID)
      .eq('source', 'pos')
      .eq('source_id', sale.id)
      .maybeSingle()

    if (!journalEntry) {
      issues.push({
        type:        'sale_missing_journal',
        severity:    'warning',
        description: `فاتورة بيع ${sale.invoice_number} بدون قيد محاسبي`,
        entity_id:   sale.id,
        expected:    sale.total,
      })
    }
  }

  // ── 3. Purchases missing journal entries ───────────────────────────────────
  const { data: recentPurchases } = await supabase
    .from('purchases')
    .select('id, invoice_number, total')
    .eq('company_id', COMPANY_ID)
    .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())

  for (const purchase of recentPurchases || []) {
    const { data: journalEntry } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', COMPANY_ID)
      .eq('source', 'purchase')
      .eq('source_id', purchase.id)
      .maybeSingle()

    if (!journalEntry) {
      issues.push({
        type:        'purchase_missing_journal',
        severity:    'warning',
        description: `فاتورة شراء ${purchase.invoice_number} بدون قيد محاسبي`,
        entity_id:   purchase.id,
        expected:    purchase.total,
      })
    }
  }

  // ── 4. Unbalanced journal entries ──────────────────────────────────────────
  const { data: entries } = await supabase
    .from('journal_entries')
    .select('id, reference, journal_entry_lines(debit, credit)')
    .eq('company_id', COMPANY_ID)
    .eq('is_posted', true)
    .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))

  for (const entry of entries || []) {
    const lines = (entry.journal_entry_lines as any[]) || []
    const totalDebit  = lines.reduce((s: number, l: any) => s + Number(l.debit),  0)
    const totalCredit = lines.reduce((s: number, l: any) => s + Number(l.credit), 0)
    const diff = Math.abs(totalDebit - totalCredit)
    if (diff > 0.001) {
      issues.push({
        type:        'unbalanced_journal_entry',
        severity:    'critical',
        description: `قيد محاسبي غير متوازن: ${entry.reference}`,
        entity_id:   entry.id,
        expected:    totalDebit,
        actual:      totalCredit,
        diff,
      })
    }
  }

  // ── 5. Report vs raw data verification ────────────────────────────────────
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: salesAgg } = await supabase
    .from('sales')
    .select('total')
    .eq('company_id', COMPANY_ID)
    .eq('status', 'completed')
    .gte('created_at', since30)

  const rawRevenue = (salesAgg || []).reduce((s, x) => s + Number(x.total), 0)

  // Verify against journal entries revenue account
  const { data: revenueLines } = await supabase
    .from('journal_entry_lines')
    .select('credit, accounts!inner(code, company_id)')
    .eq('accounts.code', '4001')
    .eq('accounts.company_id', COMPANY_ID)

  const journalRevenue = (revenueLines || []).reduce((s: number, l: any) => s + Number(l.credit), 0)
  const revDiff = Math.abs(rawRevenue - journalRevenue)

  if (revDiff > 1 && rawRevenue > 0) {
    issues.push({
      type:        'revenue_mismatch',
      severity:    revDiff > rawRevenue * 0.1 ? 'critical' : 'warning',
      description: `إجمالي المبيعات لا يتطابق مع القيود المحاسبية`,
      expected:    rawRevenue,
      actual:      journalRevenue,
      diff:        revDiff,
    })
  }

  // ── Log all issues ─────────────────────────────────────────────────────────
  for (const issue of issues) {
    await supabase.from('audit_logs').insert({
      company_id: COMPANY_ID,
      action:     `integrity.${issue.type}`,
      entity_type: 'system',
      entity_id:   issue.entity_id || 'integrity_check',
      new_value:   issue,
      severity:    issue.severity,
    }).then(() => {})
  }

  const criticalCount = issues.filter(i => i.severity === 'critical').length
  const warningCount  = issues.filter(i => i.severity === 'warning').length

  return NextResponse.json({
    ok:            issues.length === 0,
    checked_at:    new Date().toISOString(),
    total_issues:  issues.length,
    critical:      criticalCount,
    warnings:      warningCount,
    issues,
    summary:       issues.length === 0
      ? 'النظام المالي سليم — لا توجد تناقضات'
      : `${criticalCount} مشكلة حرجة، ${warningCount} تحذير`,
  })
}

// POST — force-run from admin UI
export async function POST(req: NextRequest) {
  return GET(req)
}
