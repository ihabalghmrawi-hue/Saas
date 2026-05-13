import { NextResponse } from 'next/server'
import { runHealthChecks, createMemoryHealthChecker, registerHealthCheck } from '@/lib/metrics/health-probes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let registered = false
function ensureChecks() {
  if (registered) return
  registerHealthCheck('memory', createMemoryHealthChecker())
  registered = true
}

export async function GET() {
  ensureChecks()
  const report = await runHealthChecks()
  const ready = report.status !== 'unhealthy'

  return NextResponse.json(
    { ready, status: report.status, checks: report.checks, timestamp: report.timestamp },
    { status: ready ? 200 : 503 },
  )
}
