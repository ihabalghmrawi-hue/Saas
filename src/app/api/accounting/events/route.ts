import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { AccountingEventBus, processRecurringJournals, suggestReconciliations, runIntegrityChecks } from '@/lib/accounting/event-bus'

export async function POST(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase = createAdminClient()
  const body = await req.json()

  switch (body.action) {
    case 'emit-event': {
      const bus = new AccountingEventBus(supabase, ctx.companyId)
      await bus.emit(body.event)
      return ok({ emitted: true })
    }

    case 'process-recurring': {
      const result = await processRecurringJournals(supabase)
      return ok(result)
    }

    case 'suggest-reconciliations': {
      const result = await suggestReconciliations(supabase)
      return ok(result)
    }

    case 'integrity-check': {
      const result = await runIntegrityChecks(supabase)
      return ok(result)
    }

    default:
      return Errors.badRequest('إجراء غير معروف')
  }
}
