// POST /api/entity/restore/:type/:id — restore from trash
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { restoreEntity } from '@/lib/data-lifecycle'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

type Ctx = { params: { type: string; id: string } }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const COMPANY_ID = getCompanyId()
  const h          = headers()
  const staffName  = h.get('x-staff-name') || 'system'

  const result = await restoreEntity(params.type, params.id, COMPANY_ID)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const supabase = createClient()
  await supabase.from('audit_logs').insert({
    company_id:  COMPANY_ID,
    staff_name:  staffName,
    action:      'entity.restored',
    entity_type: params.type,
    entity_id:   params.id,
    severity:    'info',
  }).then(() => {})

  return NextResponse.json({ ok: true })
}
