import { NextResponse } from 'next/server'
import { generatePrometheusFormat, getAllMetrics } from '@/lib/metrics/collector'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const prometheus = generatePrometheusFormat()
  const raw = getAllMetrics()

  return NextResponse.json({
    format: 'prometheus',
    generated: new Date().toISOString(),
    metrics: prometheus,
    raw,
  })
}
