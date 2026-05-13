import { NextRequest, NextResponse } from 'next/server'
import { getTrace, getCurrentTraceId, exportTrace, getActiveSpanCount } from '@/lib/observability/tracer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const traceId = req.nextUrl.searchParams.get('traceId') || getCurrentTraceId()

  if (traceId) {
    const trace = getTrace(traceId)
    if (trace.length === 0) {
      return NextResponse.json({ error: 'Trace not found' }, { status: 404 })
    }
    return NextResponse.json({
      traceId,
      spans: trace.length,
      export: exportTrace(traceId),
      raw: trace,
    })
  }

  return NextResponse.json({
    activeSpans: getActiveSpanCount(),
    timestamp: new Date().toISOString(),
    message: 'Provide ?traceId= to export a specific trace',
  })
}
