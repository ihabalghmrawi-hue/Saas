// ============================================================
// Journal Entry Engine
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { JournalLine, JournalEntryInput, PostingResult } from './types'
import { ensureCOA } from './coa'
import { getOrCreatePeriod } from './periods'

export const AUTO_POST_CODES = {
  CASH:             '1101',
  BANK:             '1102',
  RECEIVABLE:       '1110',
  INVENTORY:        '1120',
  PREPAID:          '1130',
  INPUT_VAT:        '1140',
  EQUIPMENT:        '1201',
  PAYABLE:          '2101',
  VAT_PAYABLE:      '2103',
  ACCRUED_EXP:      '2104',
  SALARIES_PAYABLE: '2106',
  CAPITAL:          '3001',
  RETAINED:         '3002',
  INCOME_SUMMARY:   '3099',
  SALES:            '4001',
  SALES_RETURNS:    '4002',
  COGS:             '5001',
  PURCHASES:        '5002',
  PURCHASE_RETURNS: '5003',
  SALARIES_EXP:     '6101',
  RENT:             '6201',
  UTILITIES:        '6202',
  MARKETING:        '6301',
  BANK_CHARGES:     '6402',
  MISC_EXP:         '6501',
  INV_WRITEOFF:     '6502',
} as const

// ── generateEntryNumber ───────────────────────────────────────
export async function generateEntryNumber(
  supabase:   SupabaseClient,
  company_id: string,
): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `JE-${year}-`

  const { data } = await supabase
    .from('journal_entries')
    .select('entry_number')
    .eq('company_id', company_id)
    .like('entry_number', `${prefix}%`)
    .order('entry_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextNum = 1
  if (data?.entry_number) {
    const parts = data.entry_number.split('-')
    const last  = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(last)) nextNum = last + 1
  }

  return `${prefix}${String(nextNum).padStart(5, '0')}`
}

// ── validateJournalEntry ──────────────────────────────────────
export function validateJournalEntry(
  lines: JournalLine[],
): { valid: boolean; error?: string } {
  if (!lines || lines.length < 2) {
    return { valid: false, error: 'القيد يجب أن يحتوي على سطرين على الأقل' }
  }

  let totalDebit  = 0
  let totalCredit = 0

  for (const line of lines) {
    if (line.debit < 0 || line.credit < 0) {
      return { valid: false, error: 'لا يمكن أن تكون المبالغ سالبة' }
    }
    if (line.debit > 0 && line.credit > 0) {
      return { valid: false, error: 'لا يمكن أن يحتوي السطر الواحد على مدين ودائن في نفس الوقت' }
    }
    if (line.debit === 0 && line.credit === 0) {
      return { valid: false, error: 'يجب أن يحتوي كل سطر على مبلغ مدين أو دائن' }
    }
    if (!line.account_code && !line.account_id) {
      return { valid: false, error: 'كل سطر يجب أن يحتوي على رمز الحساب' }
    }
    totalDebit  += line.debit
    totalCredit += line.credit
  }

  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    return {
      valid: false,
      error: `القيد غير متوازن: مدين ${totalDebit.toFixed(2)} ≠ دائن ${totalCredit.toFixed(2)}`,
    }
  }

  return { valid: true }
}

// ── createJournalEntry ────────────────────────────────────────
export async function createJournalEntry(
  supabase: SupabaseClient,
  input:    JournalEntryInput,
): Promise<PostingResult> {
  const {
    company_id, description, description_ar, reference,
    source, source_id, source_document, lines,
    auto_generated = false,
    date,
    fiscal_year_id: inputFiscalYearId,
    period_id:      inputPeriodId,
  } = input

  // 1. Validate
  const validation = validateJournalEntry(lines)
  if (!validation.valid) {
    return { ok: false, error: validation.error }
  }

  // 2. Ensure COA exists and get account map
  let accountMap: Record<string, string>
  let accounts_created = false
  try {
    const result = await ensureCOA(supabase, company_id)
    accountMap       = result.accounts
    accounts_created = result.created
  } catch (e: any) {
    return { ok: false, error: `فشل تجهيز دليل الحسابات: ${e.message}` }
  }

  // 3. Resolve account codes to IDs
  const resolvedLines: Array<{
    account_id:  string
    debit:       number
    credit:      number
    description: string | null
    line_number: number
  }> = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let accountId: string | null = null

    if (line.account_id) {
      accountId = line.account_id
    } else if (line.account_code) {
      accountId = accountMap[line.account_code] || null
      if (!accountId) {
        return { ok: false, error: `الحساب غير موجود: ${line.account_code}` }
      }
    }

    if (!accountId) {
      return { ok: false, error: `السطر ${i + 1}: لم يتم تحديد الحساب` }
    }

    resolvedLines.push({
      account_id:  accountId,
      debit:       line.debit,
      credit:      line.credit,
      description: line.description || null,
      line_number: i + 1,
    })
  }

  // 4. Get period info
  const entryDate = date || new Date().toISOString().slice(0, 10)
  let fiscal_year_id = inputFiscalYearId || null
  let period_id      = inputPeriodId      || null

  if (!fiscal_year_id || !period_id) {
    try {
      const periodInfo = await getOrCreatePeriod(supabase, company_id, entryDate)
      if (!fiscal_year_id) fiscal_year_id = periodInfo.fiscal_year_id
      if (!period_id)      period_id      = periodInfo.period_id
    } catch {
      // Non-fatal: continue without period
    }
  }

  // 5. Generate entry number
  const entry_number = await generateEntryNumber(supabase, company_id)

  // 6. Calculate totals
  const total_debit  = resolvedLines.reduce((s, l) => s + l.debit,  0)
  const total_credit = resolvedLines.reduce((s, l) => s + l.credit, 0)

  // 7. Determine status
  const status = auto_generated ? 'posted' : 'draft'

  // 8. Insert journal entry
  const { data: entry, error: entryErr } = await supabase
    .from('journal_entries')
    .insert({
      company_id,
      entry_number,
      date:            entryDate,
      description,
      description_ar:  description_ar  || description,
      reference:       reference       || null,
      source:          source          || 'manual',
      source_id:       source_id       || null,
      source_document: source_document || null,
      status,
      total_debit,
      total_credit,
      is_balanced:     true,
      is_posted:       auto_generated,
      auto_generated,
      fiscal_year_id,
      period_id,
      posted_at:       auto_generated ? new Date().toISOString() : null,
    })
    .select('id, entry_number')
    .single()

  if (entryErr || !entry) {
    return { ok: false, error: `فشل إنشاء القيد: ${entryErr?.message}` }
  }

  // 9. Insert journal lines
  const { error: linesErr } = await supabase
    .from('journal_entry_lines')
    .insert(
      resolvedLines.map(l => ({
        journal_entry_id: entry.id,
        account_id:       l.account_id,
        debit:            l.debit,
        credit:           l.credit,
        description:      l.description,
        line_number:      l.line_number,
      }))
    )

  if (linesErr) {
    await supabase.from('journal_entries').delete().eq('id', entry.id)
    return { ok: false, error: `فشل إدراج بنود القيد: ${linesErr.message}` }
  }

  // 10. Update account balances if posted
  if (auto_generated) {
    await updateAccountBalancesForEntry(supabase, entry.id, company_id, resolvedLines)
  }

  return {
    ok:               true,
    journal_id:       entry.id,
    entry_number:     entry.entry_number,
    accounts_created,
  }
}

// ── postJournalEntry (post a draft) ──────────────────────────
export async function postJournalEntry(
  supabase:     SupabaseClient,
  journal_id:   string,
  approved_by?: string,
): Promise<PostingResult> {
  // Fetch the entry
  const { data: entry, error: fetchErr } = await supabase
    .from('journal_entries')
    .select('*, journal_entry_lines(*, accounts(type, normal_balance))')
    .eq('id', journal_id)
    .single()

  if (fetchErr || !entry) {
    return { ok: false, error: 'القيد غير موجود' }
  }

  if (entry.status === 'posted') {
    return { ok: false, error: 'القيد مرحّل بالفعل' }
  }
  if (entry.status === 'void') {
    return { ok: false, error: 'لا يمكن ترحيل قيد ملغي' }
  }
  if (entry.status === 'reversed') {
    return { ok: false, error: 'لا يمكن ترحيل قيد معكوس' }
  }

  // Validate balance
  if (!entry.is_balanced) {
    return { ok: false, error: 'لا يمكن ترحيل قيد غير متوازن' }
  }

  const { error: updateErr } = await supabase
    .from('journal_entries')
    .update({
      status:      'posted',
      is_posted:   true,
      approved_by: approved_by || null,
      posted_at:   new Date().toISOString(),
    })
    .eq('id', journal_id)

  if (updateErr) {
    return { ok: false, error: `فشل ترحيل القيد: ${updateErr.message}` }
  }

  // Update account balances
  await updateAccountBalancesForEntry(
    supabase,
    journal_id,
    entry.company_id,
    entry.journal_entry_lines || [],
  )

  return { ok: true, journal_id, entry_number: entry.entry_number }
}

// ── reverseJournalEntry ───────────────────────────────────────
export async function reverseJournalEntry(
  supabase:   SupabaseClient,
  journal_id: string,
  company_id: string,
  reason?:    string,
): Promise<PostingResult> {
  // Fetch original entry with lines
  const { data: original, error: fetchErr } = await supabase
    .from('journal_entries')
    .select('*, journal_entry_lines(*)')
    .eq('id', journal_id)
    .eq('company_id', company_id)
    .single()

  if (fetchErr || !original) {
    return { ok: false, error: 'القيد الأصلي غير موجود' }
  }
  if (original.status !== 'posted') {
    return { ok: false, error: 'يمكن عكس القيود المرحّلة فقط' }
  }
  if (original.reversal_entry_id) {
    return { ok: false, error: 'هذا القيد تم عكسه مسبقاً' }
  }

  // Build reversed lines (swap debit/credit)
  const reversedLines: JournalLine[] = (original.journal_entry_lines || []).map((l: any) => ({
    account_code: '',
    account_id:   l.account_id,
    debit:        l.credit,
    credit:       l.debit,
    description:  l.description ? `عكس: ${l.description}` : 'قيد عكسي',
  }))

  const today = new Date().toISOString().slice(0, 10)

  const result = await createJournalEntry(supabase, {
    company_id,
    description:     `عكس قيد: ${original.description}${reason ? ` - ${reason}` : ''}`,
    description_ar:  `عكس قيد: ${original.description_ar || original.description}`,
    reference:       original.reference || undefined,
    source:          'reversal',
    source_id:       journal_id,
    source_document: `Reversal of ${original.entry_number}`,
    date:            today,
    lines:           reversedLines,
    auto_generated:  true,
  })

  if (!result.ok) return result

  // Update original entry to point to reversal
  await supabase
    .from('journal_entries')
    .update({
      status:             'reversed',
      reversal_entry_id:  result.journal_id,
    })
    .eq('id', journal_id)

  // Update reversal entry to point to original
  if (result.journal_id) {
    await supabase
      .from('journal_entries')
      .update({ reversal_of: journal_id })
      .eq('id', result.journal_id)
  }

  return result
}

// ── voidJournalEntry ──────────────────────────────────────────
export async function voidJournalEntry(
  supabase:   SupabaseClient,
  journal_id: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: entry } = await supabase
    .from('journal_entries')
    .select('id, status')
    .eq('id', journal_id)
    .single()

  if (!entry) {
    return { ok: false, error: 'القيد غير موجود' }
  }
  if (!['draft', 'pending'].includes(entry.status)) {
    return { ok: false, error: 'يمكن إلغاء القيود في حالة المسودة أو المعلقة فقط' }
  }

  const { error } = await supabase
    .from('journal_entries')
    .update({ status: 'void' })
    .eq('id', journal_id)

  if (error) {
    return { ok: false, error: `فشل إلغاء القيد: ${error.message}` }
  }

  return { ok: true }
}

// ── updateAccountBalancesForEntry (internal) ──────────────────
async function updateAccountBalancesForEntry(
  supabase:   SupabaseClient,
  journal_id: string,
  company_id: string,
  lines:      Array<{ account_id: string; debit: number; credit: number }>,
): Promise<void> {
  for (const line of lines) {
    if (!line.account_id) continue

    // Recalculate from scratch for this account
    const { data: totals } = await supabase
      .from('journal_entry_lines')
      .select('debit, credit, journal_entries!inner(status, company_id)')
      .eq('account_id', line.account_id)
      .eq('journal_entries.company_id', company_id)
      .eq('journal_entries.status', 'posted')

    const totalDebit  = (totals || []).reduce((s: number, r: any) => s + Number(r.debit  || 0), 0)
    const totalCredit = (totals || []).reduce((s: number, r: any) => s + Number(r.credit || 0), 0)

    // Get account normal_balance
    const { data: acct } = await supabase
      .from('accounts')
      .select('normal_balance')
      .eq('id', line.account_id)
      .maybeSingle()

    const balance = acct?.normal_balance === 'debit'
      ? totalDebit - totalCredit
      : totalCredit - totalDebit

    await supabase
      .from('accounts')
      .update({ current_balance: balance })
      .eq('id', line.account_id)
  }
}
