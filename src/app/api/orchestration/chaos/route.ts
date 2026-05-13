import { NextRequest } from 'next/server'
import { requireSuperAdmin, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import {
  listChaosExperiments,
  getChaosSummary,
} from '@/lib/orchestration/chaos-engineering'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = requireSuperAdmin(req)
  if (isAuthError(ctx)) return ctx

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') as 'running' | 'completed' | 'failed' | undefined

  try {
    const result = {
      experiments: listChaosExperiments(status),
      summary: getChaosSummary(),
    }
    return ok(result)
  } catch (e) {
    return Errors.serverError((e as Error).message)
  }
}
