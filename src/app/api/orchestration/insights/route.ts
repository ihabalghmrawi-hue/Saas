import { NextRequest } from 'next/server'
import { requireSuperAdmin, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import {
  getAllClusterHealth,
  getReplicationDashboard,
  getFailoverAnalytics,
  getAutoscalingInsight,
  listAnomalies,
  getOperationalSummary,
} from '@/lib/orchestration/operational-insights'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = requireSuperAdmin(req)
  if (isAuthError(ctx)) return ctx

  const { searchParams } = req.nextUrl
  const region = searchParams.get('region') || undefined
  const anomalyStatus = searchParams.get('anomalyStatus') as 'open' | 'resolved' | 'acknowledged' | undefined
  const anomalySeverity = searchParams.get('anomalySeverity') as 'low' | 'medium' | 'high' | 'critical' | undefined

  try {
    const result = {
      clusterHealth: getAllClusterHealth(),
      replicationDashboard: getReplicationDashboard(region),
      failoverAnalytics: getFailoverAnalytics(),
      anomalies: listAnomalies(anomalyStatus, anomalySeverity),
      summary: getOperationalSummary(),
    }
    return ok(result)
  } catch (e) {
    return Errors.serverError((e as Error).message)
  }
}
