import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase = createAdminClient()
  const { searchParams } = req.nextUrl
  const checkType = searchParams.get('check') || 'all'

  const results: Array<{ check: string; status: string; details: any }> = []

  // 1. Unbalanced posted entries
  if (checkType === 'all' || checkType === 'unbalanced') {
    const { data: unbalanced } = await supabase.rpc('check_unbalanced_entries', {
      p_company_id: ctx.companyId,
    })
    const count = (unbalanced || []).length
    results.push({
      check: 'unbalanced_entries',
      status: count === 0 ? 'passed' : 'failed',
      details: { count, entries: unbalanced || [] },
    })
  }

  // 2. Orphaned journal lines
  if (checkType === 'all' || checkType === 'orphaned') {
    const { data: orphaned } = await supabase.rpc('check_orphaned_lines', {
      p_company_id: ctx.companyId,
    })
    const count = (orphaned || []).length
    results.push({
      check: 'orphaned_lines',
      status: count === 0 ? 'passed' : 'failed',
      details: { count, lines: orphaned || [] },
    })
  }

  // 3. Draft entries count
  if (checkType === 'all' || checkType === 'drafts') {
    const { count } = await supabase
      .from('journal_entries')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', ctx.companyId)
      .eq('status', 'draft')

    results.push({
      check: 'draft_entries',
      status: 'warning',
      details: { count: count || 0 },
    })
  }

  // 4. Period integrity
  if (checkType === 'all' || checkType === 'periods') {
    const { data: entriesWithoutPeriod } = await supabase
      .from('journal_entries')
      .select('id, entry_number')
      .eq('company_id', ctx.companyId)
      .is('period_id', null)
      .limit(10)

    const count = entriesWithoutPeriod?.length || 0
    results.push({
      check: 'missing_periods',
      status: count === 0 ? 'passed' : 'warning',
      details: { count, entries: entriesWithoutPeriod || [] },
    })
  }

  // 5. Log integrity check
  if (checkType === 'all') {
    await supabase.from('integrity_checks').insert({
      company_id: ctx.companyId,
      check_type: 'full_integrity',
      status: results.every(r => r.status === 'passed') ? 'passed' : 'warning',
      details: { results },
    })
  }

  return ok(results)
}
