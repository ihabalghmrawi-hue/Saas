import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

// ── Response envelope types ──────────────────────────────────────────────────

export interface ApiMeta {
  page?:       number
  limit?:      number
  total?:      number
  totalPages?: number
}

export interface ApiSuccess<T> {
  data:   T
  error:  null
  meta?:  ApiMeta
}

export interface ApiErrorDetail {
  code:     string
  message:  string
  details?: unknown
}

export interface ApiFailure {
  data:  null
  error: ApiErrorDetail
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

// ── Server-side response helpers (use inside API route handlers) ─────────────

export function ok<T>(
  data: T,
  meta?: ApiMeta,
  status = 200,
): NextResponse<ApiSuccess<T>> {
  const body: ApiSuccess<T> = { data, error: null }
  if (meta) body.meta = meta
  return NextResponse.json(body, { status })
}

export function err(
  code:     string,
  message:  string,
  status  = 400,
  details?: unknown,
): NextResponse<ApiFailure> {
  const body: ApiFailure = { data: null, error: { code, message } }
  if (details !== undefined) body.error.details = details
  return NextResponse.json(body, { status })
}

export function validationError(error: ZodError): NextResponse<ApiFailure> {
  return err('VALIDATION_ERROR', 'بيانات غير صالحة', 422, error.flatten())
}

// ── Shorthand error constructors ─────────────────────────────────────────────

export const Errors = {
  unauthorized:  ()           => err('UNAUTHORIZED',   'غير مصرح به',                     401),
  forbidden:     ()           => err('FORBIDDEN',      'لا تملك صلاحية هذا الإجراء',       403),
  notFound:      (r = 'المورد') => err('NOT_FOUND',    `${r} غير موجود`,                   404),
  conflict:      (msg: string)=> err('CONFLICT',       msg,                                409),
  serverError:   (msg?: string)=> err('SERVER_ERROR',  msg ?? 'خطأ داخلي في الخادم',        500),
  rateLimited:   ()           => err('RATE_LIMITED',   'تجاوزت الحد المسموح، حاول لاحقاً', 429),
  limitExceeded: (msg: string)=> err('LIMIT_EXCEEDED', msg,                                402),
  badRequest:    (msg: string)=> err('BAD_REQUEST',    msg,                                400),
} as const
