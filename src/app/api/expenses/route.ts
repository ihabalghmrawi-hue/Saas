import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { postExpenseJournal as postExpenseEntry, updateWallet } from '@/lib/accounting'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const supabase    = createClient()
  const companyId   = req.headers.get('x-tenant-id') || ''
  const { data, error } = await supabase
    .from('expenses')
    .select('*, categories(name, name_ar)')
    .eq('company_id', companyId)
    .order('expense_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  try {
    const body    = await req.json()
    const admin   = createAdminClient()

    const { data: expense, error } = await admin
      .from('expenses')
      .insert(body)
      .select()
      .single()

    if (error) throw new Error(error.message)

    const company_id = body.company_id || expense.company_id
    const amount     = Number(body.amount || expense.amount || 0)
    const desc       = body.description || body.name || 'مصروف'

    // ── Auto journal entry ─────────────────────────────────────────────────────
    if (company_id && amount > 0) {
      const journalResult = await postExpenseEntry(admin, {
        company_id,
        expense_id:  expense.id,
        description: desc,
        amount,
        payment_method: body.payment_method || 'cash',
        wallet_id:      body.wallet_id || undefined,
      })
      if (!journalResult.ok) {
        console.error('Expense journal entry failed:', journalResult.error)
        await admin.from('audit_logs').insert({
          company_id,
          action:      'accounting.error',
          entity_type: 'expense',
          entity_id:   expense.id,
          new_value:   JSON.stringify({ error: journalResult.error }),
          severity:    'warning',
        }).then(() => {})
      }

      // ── Update wallet ────────────────────────────────────────────────────────
      const walletResult = await updateWallet(
        admin, company_id,
        -amount,
        `مصروف: ${desc}`,
        expense.id, 'expense', body.payment_method || 'cash',
      )
      if (!walletResult.ok) {
        console.error('Wallet update failed:', walletResult.error)
      }
    }

    await logAudit({ action: 'expense.created', entityType: 'expense', entityId: expense.id, newValue: { amount, description: desc } })

    return NextResponse.json({ expense })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
