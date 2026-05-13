import { NextRequest } from 'next/server'
import { requireSuperAdmin, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import {
  listRuntimePolicies,
  getGovernanceSummary,
} from '@/lib/orchestration/runtime-governance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = requireSuperAdmin(req)
  if (isAuthError(ctx)) return ctx

  try {
    const result = {
      policies: listRuntimePolicies(),
      governance: getGovernanceSummary(),
    }
    return ok(result)
  } catch (e) {
    return Errors.serverError((e as Error).message)
  }
}
