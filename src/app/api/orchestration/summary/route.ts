import { NextRequest } from 'next/server'
import { requireSuperAdmin, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { getOperatorSummary } from '@/lib/orchestration/operator-runtime'
import { getMultiRegionSummary } from '@/lib/orchestration/multi-region-coordinator'
import { getReplicationSummary } from '@/lib/orchestration/event-replicator'
import { getAutoscalerSummary } from '@/lib/orchestration/autoscaler'
import { getFailoverSummary } from '@/lib/orchestration/failover-orchestrator'
import { getGovernanceSummary } from '@/lib/orchestration/runtime-governance'
import { getOperationalSummary } from '@/lib/orchestration/operational-insights'
import { getChaosSummary } from '@/lib/orchestration/chaos-engineering'
import { getResilienceSummary } from '@/lib/orchestration/resilience-validator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = requireSuperAdmin(req)
  if (isAuthError(ctx)) return ctx

  try {
    const summary = {
      operator: getOperatorSummary(),
      multiRegion: getMultiRegionSummary(),
      replication: getReplicationSummary(),
      autoscaler: getAutoscalerSummary(),
      failover: getFailoverSummary(),
      governance: getGovernanceSummary(),
      operational: getOperationalSummary(),
      resilience: getResilienceSummary(),
      chaos: getChaosSummary(),
    }
    return ok(summary)
  } catch (e) {
    return Errors.serverError((e as Error).message)
  }
}
