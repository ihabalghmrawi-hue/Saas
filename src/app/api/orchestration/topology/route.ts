import { NextRequest } from 'next/server'
import { requireSuperAdmin, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import {
  listClusterNodes,
  listWorkerTopologies,
  listQueuePartitions,
  listRegionTopologies,
  listSchedulerTopologies,
  listTenantPlacements,
  takeTopologySnapshot,
  detectTopologyAnomalies,
} from '@/lib/orchestration/topology-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = requireSuperAdmin(req)
  if (isAuthError(ctx)) return ctx

  const { searchParams } = req.nextUrl
  const snapshot = searchParams.get('snapshot') === 'true'
  const anomalies = searchParams.get('anomalies') === 'true'

  try {
    const result: Record<string, unknown> = {
      clusterNodes: listClusterNodes(),
      workers: listWorkerTopologies(),
      queues: listQueuePartitions(),
      regions: listRegionTopologies(),
      schedulers: listSchedulerTopologies(),
      tenants: listTenantPlacements(),
    }
    if (snapshot) result.snapshot = takeTopologySnapshot()
    if (anomalies) result.anomalies = detectTopologyAnomalies()
    return ok(result)
  } catch (e) {
    return Errors.serverError((e as Error).message)
  }
}
