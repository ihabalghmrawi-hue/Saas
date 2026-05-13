import { describe, it, expect } from 'vitest'
import { ok, err, Errors, validationError } from '@/lib/api-response'
import { ZodError } from 'zod'

describe('ok()', () => {
  it('returns a 200 JSON response by default', async () => {
    const res = ok({ data: 'test' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({ data: 'test' })
    expect(body.error).toBeNull()
  })

  it('supports custom status code', async () => {
    const res = ok({}, undefined, 201)
    expect(res.status).toBe(201)
  })

  it('includes metadata when provided', async () => {
    const res = ok([], { page: 1, limit: 10, total: 100, totalPages: 10 })
    const body = await res.json()
    expect(body.meta).toEqual({ page: 1, limit: 10, total: 100, totalPages: 10 })
  })
})

describe('err()', () => {
  it('returns error response with code and message', async () => {
    const res = err('NOT_FOUND', 'Resource not found', 404)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('Resource not found')
    expect(body.data).toBeNull()
  })

  it('supports custom details', async () => {
    const res = err('BAD_REQUEST', 'Invalid input', 400, { field: 'email' })
    const body = await res.json()
    expect(body.error.details).toEqual({ field: 'email' })
  })
})

describe('validationError', () => {
  it('returns 422 with Zod flattened errors', () => {
    const schema = (v: unknown) => {
      throw new ZodError([{ code: 'invalid_type', expected: 'string', received: 'number', path: ['name'], message: 'Expected string' }])
    }
    try { schema(null) } catch (e) {
      const res = validationError(e as ZodError)
      expect(res.status).toBe(422)
    }
  })
})

describe('Errors factories', () => {
  it('unauthorized returns 401', async () => {
    const res = Errors.unauthorized()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('forbidden returns 403', async () => {
    const res = Errors.forbidden()
    expect(res.status).toBe(403)
  })

  it('notFound returns 404', async () => {
    const res = Errors.notFound()
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.message).toContain('غير موجود')
  })

  it('serverError returns 500', async () => {
    const res = Errors.serverError()
    expect(res.status).toBe(500)
  })

  it('rateLimited returns 429', async () => {
    const res = Errors.rateLimited()
    expect(res.status).toBe(429)
  })
})
