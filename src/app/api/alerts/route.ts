import { NextRequest, NextResponse } from 'next/server'
import { evaluateAlerts, getActiveAlerts, acknowledgeAlert, getAlertHistory } from '@/lib/alerting/alert-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const active = getActiveAlerts()
  const history = getAlertHistory()

  return NextResponse.json({
    active,
    history,
    activeCount: active.length,
    timestamp: new Date().toISOString(),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { action, alertName, acknowledgedBy } = body as {
    action?: string
    alertName?: string
    acknowledgedBy?: string
  }

  if (action === 'evaluate') {
    const fired = await evaluateAlerts()
    return NextResponse.json({ fired, count: fired.length })
  }

  if (action === 'acknowledge') {
    if (!alertName || !acknowledgedBy) {
      return NextResponse.json({ error: 'alertName and acknowledgedBy required' }, { status: 422 })
    }
    const result = acknowledgeAlert(alertName, acknowledgedBy)
    if (!result) {
      return NextResponse.json({ error: `Alert "${alertName}" not found` }, { status: 404 })
    }
    return NextResponse.json({ acknowledged: result })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
