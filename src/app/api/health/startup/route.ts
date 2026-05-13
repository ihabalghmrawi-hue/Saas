import { NextResponse } from 'next/server'
import { startupTime } from '@/lib/metrics/health-probes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GRACE_PERIOD_MS = 60_000

export async function GET() {
  const started = startupTime()
  const elapsed = Date.now() - started
  const ready = elapsed >= GRACE_PERIOD_MS

  return NextResponse.json(
    {
      started: new Date(started).toISOString(),
      elapsed,
      gracePeriod: GRACE_PERIOD_MS,
      ready,
    },
    { status: ready ? 200 : 503 },
  )
}
