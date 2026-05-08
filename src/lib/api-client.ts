'use client'

/**
 * Typed fetch client for use in React components / client code.
 *
 * All helpers return ApiResult<T>:
 *   { data: T;    error: null }   on success
 *   { data: null; error: ApiErrorDetail } on failure
 *
 * Works with routes that use the new ApiEnvelope format (ok() / err() helpers).
 * Legacy routes that return plain objects can still be called via rawFetch().
 */

import type { ApiErrorDetail, ApiEnvelope } from './api-response'

export type ApiResult<T> =
  | { data: T;    error: null }
  | { data: null; error: ApiErrorDetail }

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function coreFetch<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    return { data: null, error: { code: 'NETWORK_ERROR', message: 'تعذّر الاتصال بالخادم' } }
  }

  let json: ApiEnvelope<T> & Record<string, unknown>
  try {
    json = await res.json()
  } catch {
    return { data: null, error: { code: 'PARSE_ERROR', message: 'استجابة غير صالحة من الخادم' } }
  }

  // New envelope format: { data, error }
  if ('data' in json && 'error' in json) {
    if (json.error !== null) {
      const e = json.error as ApiErrorDetail
      return { data: null, error: e }
    }
    return { data: json.data as T, error: null }
  }

  // Legacy format: plain object — pass through on 2xx, wrap error on non-2xx
  if (!res.ok) {
    const msg = (json as any).error ?? (json as any).message ?? `HTTP ${res.status}`
    return { data: null, error: { code: `HTTP_${res.status}`, message: typeof msg === 'string' ? msg : 'خطأ في الخادم' } }
  }
  return { data: json as unknown as T, error: null }
}

// ── Public helpers ────────────────────────────────────────────────────────────

export function apiGet<T>(
  url: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<ApiResult<T>> {
  let fullUrl = url
  if (params) {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) q.set(k, String(v))
    }
    const qs = q.toString()
    if (qs) fullUrl = `${url}?${qs}`
  }
  return coreFetch<T>(fullUrl, { method: 'GET' })
}

export function apiPost<TRes, TBody = unknown>(
  url: string,
  body: TBody,
): Promise<ApiResult<TRes>> {
  return coreFetch<TRes>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function apiPatch<TRes, TBody = unknown>(
  url: string,
  body: TBody,
): Promise<ApiResult<TRes>> {
  return coreFetch<TRes>(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function apiPut<TRes, TBody = unknown>(
  url: string,
  body: TBody,
): Promise<ApiResult<TRes>> {
  return coreFetch<TRes>(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function apiDelete<T = { success: boolean }>(
  url: string,
): Promise<ApiResult<T>> {
  return coreFetch<T>(url, { method: 'DELETE' })
}

// ── Factory: client with shared config (e.g. per-tenant headers) ─────────────

export interface ApiClientConfig {
  baseUrl?: string
  headers?: Record<string, string>
}

export function createApiClient(config: ApiClientConfig = {}) {
  function buildInit(init?: RequestInit): RequestInit {
    return {
      ...init,
      headers: { ...(config.headers ?? {}), ...(init?.headers ?? {}) },
    }
  }

  const base = config.baseUrl ?? ''

  return {
    get:    <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
              apiGet<T>(`${base}${path}`, params),
    post:   <TRes, TBody = unknown>(path: string, body: TBody) =>
              coreFetch<TRes>(`${base}${path}`, { ...buildInit(), method: 'POST', body: JSON.stringify(body) }),
    patch:  <TRes, TBody = unknown>(path: string, body: TBody) =>
              coreFetch<TRes>(`${base}${path}`, { ...buildInit(), method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T = { success: boolean }>(path: string) =>
              coreFetch<T>(`${base}${path}`, { ...buildInit(), method: 'DELETE' }),
  }
}
