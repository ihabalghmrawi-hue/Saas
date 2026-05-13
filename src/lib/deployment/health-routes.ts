import { NextResponse } from 'next/server'
import { runHealthChecks, livenessCheck } from '@/lib/metrics/health-probes'

export async function GET_health(): Promise<NextResponse> {
  const result = await livenessCheck()
  return NextResponse.json(result, { status: result.status === 'alive' ? 200 : 503 })
}

export async function GET_ready(): Promise<NextResponse> {
  const report = await runHealthChecks()
  const status = report.status === 'healthy' ? 200 : report.status === 'degraded' ? 200 : 503
  return NextResponse.json(report, { status })
}

export async function GET_startup(): Promise<NextResponse> {
  const report = await runHealthChecks()
  const isReady = report.status !== 'unhealthy'
  return NextResponse.json({ ready: isReady, checks: report }, { status: isReady ? 200 : 503 })
}
