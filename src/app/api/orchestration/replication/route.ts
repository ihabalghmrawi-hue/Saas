import { NextRequest } from 'next/server'
import { requireSuperAdmin, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import {
  listReplicatedStreams,
  getReplicationSummary,
} from '@/lib/orchestration/event-replicator'
import {
  listRegionMetadatas,
  listReplicationCoordinators,
  getCriticalReplicationLags,
} from '@/lib/orchestration/multi-region-coordinator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = requireSuperAdmin(req)
  if (isAuthError(ctx)) return ctx

  try {
    const result = {
      regions: listRegionMetadatas(),
      streams: listReplicatedStreams(),
      coordinators: listReplicationCoordinators(),
      criticalLags: getCriticalReplicationLags(),
      summary: getReplicationSummary(),
    }
    return ok(result)
  } catch (e) {
    return Errors.serverError((e as Error).message)
  }
}
