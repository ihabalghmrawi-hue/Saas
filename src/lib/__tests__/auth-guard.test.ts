import { describe, it, expect } from 'vitest'
import { NextRequest }           from 'next/server'
import { requireAuth, requireCompany, requireRole, isAuthError } from '@/lib/auth-guard'

function makeRequest(headers: Record<string, string> = {}) {
  const req = new NextRequest('http://localhost:3000/api/test')
  Object.entries(headers).forEach(([k, v]) => req.headers.set(k, encodeURIComponent(v)))
  return req
}

const validHeaders = {
  'x-tenant-id':         'test-company-uuid',
  'x-staff-id':          'staff-uuid',
  'x-staff-name':        'Test User',
  'x-staff-role':        'admin',
  'x-staff-permissions': '*',
  'x-is-super-admin':    'false',
  'x-sub-status':        'active',
  'x-sub-plan':          'pro',
}

describe('requireAuth', () => {
  it('returns context when all headers present', () => {
    const ctx = requireAuth(makeRequest(validHeaders))
    expect(isAuthError(ctx)).toBe(false)
    if (!isAuthError(ctx)) {
      expect(ctx.companyId).toBe('test-company-uuid')
      expect(ctx.staffId).toBe('staff-uuid')
    }
  })

  it('returns 401 when no headers', () => {
    const ctx = requireAuth(makeRequest())
    expect(isAuthError(ctx)).toBe(true)
    if (isAuthError(ctx)) {
      expect(ctx.status).toBe(401)
    }
  })
})

describe('requireCompany', () => {
  it('returns 403 when company is "default"', () => {
    const ctx = requireCompany(makeRequest({ ...validHeaders, 'x-tenant-id': 'default' }))
    expect(isAuthError(ctx)).toBe(true)
    if (isAuthError(ctx)) expect(ctx.status).toBe(403)
  })

  it('returns 403 when company is "super_admin"', () => {
    const ctx = requireCompany(makeRequest({ ...validHeaders, 'x-tenant-id': 'super_admin' }))
    expect(isAuthError(ctx)).toBe(true)
    if (isAuthError(ctx)) expect(ctx.status).toBe(403)
  })

  it('returns 402 when subscription is suspended', () => {
    const ctx = requireCompany(makeRequest({ ...validHeaders, 'x-sub-status': 'suspended' }))
    expect(isAuthError(ctx)).toBe(true)
    if (isAuthError(ctx)) expect(ctx.status).toBe(402)
  })

  it('passes valid context through', () => {
    const ctx = requireCompany(makeRequest(validHeaders))
    expect(isAuthError(ctx)).toBe(false)
  })
})

describe('requireRole', () => {
  it('returns 403 when permission missing', () => {
    const ctx = requireRole(
      makeRequest({ ...validHeaders, 'x-staff-permissions': 'sales.view,pos.access' }),
      'admin.settings'
    )
    expect(isAuthError(ctx)).toBe(true)
    if (isAuthError(ctx)) expect(ctx.status).toBe(403)
  })

  it('passes when wildcard permission (*)', () => {
    const ctx = requireRole(makeRequest(validHeaders), 'admin.settings')
    expect(isAuthError(ctx)).toBe(false)
  })

  it('passes when exact permission present', () => {
    const ctx = requireRole(
      makeRequest({ ...validHeaders, 'x-staff-permissions': 'sales.create,pos.access' }),
      'sales.create'
    )
    expect(isAuthError(ctx)).toBe(false)
  })
})

describe('tenant isolation', () => {
  it('does not leak company_id across requests', () => {
    const req1 = makeRequest({ ...validHeaders, 'x-tenant-id': 'company-a' })
    const req2 = makeRequest({ ...validHeaders, 'x-tenant-id': 'company-b' })

    const ctx1 = requireCompany(req1)
    const ctx2 = requireCompany(req2)

    if (!isAuthError(ctx1) && !isAuthError(ctx2)) {
      expect(ctx1.companyId).toBe('company-a')
      expect(ctx2.companyId).toBe('company-b')
      expect(ctx1.companyId).not.toBe(ctx2.companyId)
    }
  })
})
