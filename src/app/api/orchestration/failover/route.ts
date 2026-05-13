import { NextRequest } from 'next/server'
import { requireSuperAdmin, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import {
  listFailoverPlans,
  getFailoverSummary,
  listRecoveryActions,
  listCacheRebuildPlans,
} from '@/lib/orchestration/failover-orchestrator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = requireSuperAdmin(req)
  if (isAuthError(ctx)) return ctx

  try {
    const result = {
      plans: listFailoverPlans(),
      recoveryActions: listRecoveryActions(),
      cacheRebuilds: listCacheRebuildPlans(),
      summary: getFailoverSummary(),
    }
    return ok(result)
  } catch (e) {
    return Errors.serverError((e as Error).message)
  }
}
