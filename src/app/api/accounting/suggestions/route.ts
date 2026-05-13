import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { AIAccountingEngine } from '@/lib/accounting/index'

export async function POST(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase = createAdminClient()
  const engine = new AIAccountingEngine(supabase, ctx.companyId)
  const body = await req.json()

  switch (body.action) {
    case 'suggest-journal': {
      const suggestions = await engine.suggestJournalEntry(
        body.description || '',
        body.amount ? Number(body.amount) : undefined,
      )
      return ok(suggestions)
    }

    case 'auto-categorize': {
      const result = await engine.autoCategorize(body.description || '')
      return ok(result)
    }

    case 'detect-recurring': {
      const recurring = await engine.detectRecurringTransactions()
      return ok(recurring)
    }

    case 'suggest-reconciliation': {
      const suggestions = await engine.suggestReconciliation()
      return ok(suggestions)
    }

    default:
      return Errors.badRequest('إجراء غير معروف')
  }
}
