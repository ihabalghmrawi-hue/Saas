/**
 * Centralized authorization layer for API routes.
 *
 * Usage:
 *   const ctx = await requireAuth(request)
 *   if (ctx instanceof NextResponse) return ctx          // 401/403
 *
 *   const ctx = await requireRole(request, 'sales.create')
 *   if (ctx instanceof NextResponse) return ctx
 */

import { NextRequest, NextResponse } from 'next/server'
import { Errors }                    from '@/lib/api-response'

// ── AuthContext ───────────────────────────────────────────────────────────────

export interface AuthContext {
  companyId:   string
  staffId:     string
  staffName:   string
  staffRole:   string
  permissions: string[]
  isSuperAdmin: boolean
  subStatus:   string
  subPlan:     string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function decode(v: string | null, fallback = ''): string {
  if (!v) return fallback
  try { return decodeURIComponent(v) } catch { return v }
}

function extractContext(req: NextRequest): AuthContext | null {
  const companyId = decode(req.headers.get('x-tenant-id'))
  const staffId   = decode(req.headers.get('x-staff-id'))
  const staffRole = decode(req.headers.get('x-staff-role'))

  if (!companyId || !staffId) return null

  const permHeader = decode(req.headers.get('x-staff-permissions'))
  const permissions = permHeader === '*' ? ['*'] : permHeader.split(',').filter(Boolean)

  return {
    companyId,
    staffId,
    staffName:    decode(req.headers.get('x-staff-name')),
    staffRole,
    permissions,
    isSuperAdmin: req.headers.get('x-is-super-admin') === 'true',
    subStatus:    decode(req.headers.get('x-sub-status'), 'active'),
    subPlan:      decode(req.headers.get('x-sub-plan'),   'free'),
  }
}

function hasPermission(permissions: string[], perm: string): boolean {
  if (permissions.includes('*')) return true
  return permissions.includes(perm)
}

// ── Guards ────────────────────────────────────────────────────────────────────

/**
 * Require any authenticated user.
 * Returns AuthContext on success, NextResponse(401) on failure.
 */
export function requireAuth(req: NextRequest): AuthContext | NextResponse {
  const ctx = extractContext(req)
  if (!ctx) return Errors.unauthorized()
  return ctx
}

/**
 * Require authenticated user with a valid (non-default) company.
 * Returns AuthContext on success, NextResponse(401/403) on failure.
 */
export function requireCompany(req: NextRequest): AuthContext | NextResponse {
  const ctx = extractContext(req)
  if (!ctx) return Errors.unauthorized()

  if (!ctx.companyId || ctx.companyId === 'default' || ctx.companyId === 'super_admin') {
    return Errors.forbidden()
  }

  // Block access if subscription is hard-blocked
  if (ctx.subStatus === 'suspended' || ctx.subStatus === 'cancelled') {
    return NextResponse.json(
      { data: null, error: { code: 'SUBSCRIPTION_BLOCKED', message: 'الاشتراك موقف أو ملغي' } },
      { status: 402 }
    )
  }

  return ctx
}

/**
 * Require authenticated user with a specific permission.
 * Returns AuthContext on success, NextResponse(401/403) on failure.
 */
export function requireRole(req: NextRequest, permission: string): AuthContext | NextResponse {
  const ctx = requireCompany(req)
  if (ctx instanceof NextResponse) return ctx

  if (!hasPermission(ctx.permissions, permission)) {
    return Errors.forbidden()
  }

  return ctx
}

/**
 * Require super admin.
 */
export function requireSuperAdmin(req: NextRequest): AuthContext | NextResponse {
  const ctx = extractContext(req)
  if (!ctx) return Errors.unauthorized()
  if (!ctx.isSuperAdmin) return Errors.forbidden()
  return ctx
}

/**
 * Type guard to check if result is an error response.
 */
export function isAuthError(result: AuthContext | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
