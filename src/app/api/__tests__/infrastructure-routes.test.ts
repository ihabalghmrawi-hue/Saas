import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/metrics/collector', () => ({
  incrementCounter: vi.fn(),
  setGauge: vi.fn(),
  observeHistogram: vi.fn(),
  getAllMetrics: vi.fn().mockReturnValue({
    http_requests: [{ value: 42, timestamp: Date.now(), labels: { method: 'GET' } }],
  }),
  generatePrometheusFormat: vi.fn().mockReturnValue('# HELP http_requests_total\nhttp_requests_total 42'),
  resetMetrics: vi.fn(),
}))

vi.mock('@/lib/metrics/health-probes', () => ({
  livenessCheck: vi.fn().mockResolvedValue({ status: 'alive', timestamp: new Date().toISOString() }),
  runHealthChecks: vi.fn().mockResolvedValue({
    status: 'healthy',
    checks: [
      { status: 'healthy', component: 'memory', message: 'ok', duration: 1, lastChecked: new Date().toISOString() },
    ],
    timestamp: new Date().toISOString(),
    uptime: 1000,
    version: '1.0.0',
  }),
  startupTime: vi.fn().mockReturnValue(Date.now() - 120_000),
  createMemoryHealthChecker: vi.fn().mockReturnValue(vi.fn().mockResolvedValue({
    status: 'healthy', component: 'memory', message: 'ok', duration: 1, lastChecked: new Date().toISOString(),
  })),
  registerHealthCheck: vi.fn(),
}))

vi.mock('@/lib/alerting/alert-engine', () => ({
  evaluateAlerts: vi.fn().mockResolvedValue([
    { name: 'test_alert', severity: 'warning', source: 'test', message: 'test firing', status: 'firing' },
  ]),
  getActiveAlerts: vi.fn().mockReturnValue([
    { name: 'test_alert', severity: 'warning', source: 'test', message: 'active alert', status: 'firing' },
  ]),
  acknowledgeAlert: vi.fn().mockReturnValue({
    name: 'test_alert', severity: 'warning', status: 'acknowledged', acknowledgedBy: 'ops',
  }),
  getAlertHistory: vi.fn().mockReturnValue([]),
}))

vi.mock('@/lib/observability/tracer', () => ({
  getTrace: vi.fn().mockReturnValue([{ spanId: '1', traceId: 'abc', operationName: 'test' }]),
  getCurrentTraceId: vi.fn().mockReturnValue('abc'),
  exportTrace: vi.fn().mockReturnValue({ traceId: 'abc', spans: [{ spanId: '1' }] }),
  getActiveSpanCount: vi.fn().mockReturnValue(0),
}))

import { GET as healthGET } from '@/app/api/health/route'
import { GET as readinessGET } from '@/app/api/health/readiness/route'
import { GET as startupGET } from '@/app/api/health/startup/route'
import { GET as metricsGET } from '@/app/api/metrics/route'
import { GET as alertsGET, POST as alertsPOST } from '@/app/api/alerts/route'
import { GET as tracesGET } from '@/app/api/traces/route'

const toJSON = async (response: Response) => response.json()

describe('Health API Routes', () => {
  it('GET /api/health returns liveness status', async () => {
    const res = await healthGET()
    const body = await toJSON(res)
    expect(body.status).toBe('healthy')
    expect(body).toHaveProperty('timestamp')
  })

  it('GET /api/health/readiness returns readiness status', async () => {
    const res = await readinessGET()
    const body = await toJSON(res)
    expect(body).toHaveProperty('ready')
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('checks')
    expect(res.status).toBe(200)
  })

  it('GET /api/health/startup returns startup status', async () => {
    const res = await startupGET()
    const body = await toJSON(res)
    expect(body).toHaveProperty('started')
    expect(body).toHaveProperty('elapsed')
    expect(body).toHaveProperty('ready')
    expect(body.ready).toBe(true)
    expect(res.status).toBe(200)
  })
})

describe('Metrics API Route', () => {
  it('GET /api/metrics returns metrics data', async () => {
    const res = await metricsGET()
    const body = await toJSON(res)
    expect(body.format).toBe('prometheus')
    expect(body.metrics).toContain('http_requests_total')
    expect(body.raw).toHaveProperty('http_requests')
  })
})

describe('Alerts API Route', () => {
  it('GET /api/alerts returns active alerts', async () => {
    const res = await alertsGET()
    const body = await toJSON(res)
    expect(body).toHaveProperty('active')
    expect(body).toHaveProperty('activeCount')
    expect(body.active.length).toBeGreaterThanOrEqual(1)
  })

  it('POST /api/alerts with action=evaluate fires alerts', async () => {
    const req = new Request('http://localhost/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'evaluate' }),
    })
    const res = await alertsPOST(req)
    const body = await toJSON(res)
    expect(body).toHaveProperty('fired')
    expect(body.count).toBeGreaterThanOrEqual(1)
  })

  it('POST /api/alerts with action=acknowledge acknowledges alert', async () => {
    const req = new Request('http://localhost/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge', alertName: 'test_alert', acknowledgedBy: 'ops' }),
    })
    const res = await alertsPOST(req)
    const body = await toJSON(res)
    expect(body.acknowledged.status).toBe('acknowledged')
  })

  it('POST /api/alerts with unknown action returns 400', async () => {
    const req = new Request('http://localhost/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalid' }),
    })
    const res = await alertsPOST(req)
    expect(res.status).toBe(400)
  })
})

describe('Traces API Route', () => {
  it('GET /api/traces with traceId returns trace data', async () => {
    const req = new Request('http://localhost/api/traces?traceId=abc')
    const nextUrl = new URL('http://localhost/api/traces?traceId=abc')
    const nextReq = Object.assign(req, { nextUrl }) as any
    const res = await tracesGET(nextReq)
    const body = await toJSON(res)
    expect(body).toHaveProperty('traceId')
    expect(body).toHaveProperty('spans')
    expect(body).toHaveProperty('export')
  })

  it('GET /api/traces with search params works for current trace', async () => {
    const req = new Request('http://localhost/api/traces')
    const nextUrl = new URL('http://localhost/api/traces')
    const nextReq = Object.assign(req, { nextUrl }) as any
    const res = await tracesGET(nextReq)
    const body = await toJSON(res)
    expect(body).toHaveProperty('traceId')
  })
})
