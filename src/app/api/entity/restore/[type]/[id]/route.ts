// POST /api/entity/restore/:type/:id — restore from trash

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { restoreEntity } from '@/lib/data-lifecycle'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await context.params

  const COMPANY_ID = await getCompanyId()

  const h = await headers()

  const staffName =
    h.get('x-staff-name') || 'system'

  const result = await restoreEntity(
    type,
    id,
    COMPANY_ID
  )

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    )
  }

  const supabase = createClient()

  await supabase
    .from('audit_logs')
    .insert({
      company_id: COMPANY_ID,
      staff_name: staffName,
      action: 'entity.restored',
      entity_type: type,
      entity_id: id,
      severity: 'info',
    })
    .then(() => {})

  return NextResponse.json({ ok: true })
}