import { NextRequest } from 'next/server'
import { requireSuperAdmin, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import {
  listAutoscalePolicies,
  getScalingEvents,
  getAutoscalerSummary,
} from '@/lib/orchestration/autoscaler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = requireSuperAdmin(req)
  if (isAuthError(ctx)) return ctx

  const { searchParams } = req.nextUrl
  const policyId = searchParams.get('policyId') || undefined
  const status = searchParams.get('status') as 'pending' | 'in_progress' | 'completed' | 'failed' | undefined

  try {
    const result: Record<string, unknown> = {
      policies: listAutoscalePolicies(),
      scalingEvents: getScalingEvents(policyId, status),
      summary: getAutoscalerSummary(),
    }
    return ok(result)
  } catch (e) {
    return Errors.serverError((e as Error).message)
  }
}
