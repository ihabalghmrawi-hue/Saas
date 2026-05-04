// DELETE /api/entity/hard-delete/:type/:id — permanent delete (from trash only)
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { hardDelete } from '@/lib/data-lifecycle'
import { createClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

type Ctx = { params: { type: string; id: string } }

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const h         = headers()
  const staffName = h.get('x-staff-name') || 'system'

  const result = await hardDelete(params.type, params.id, COMPANY_ID)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const supabase = createClient()
  await supabase.from('audit_logs').insert({
    company_id:  COMPANY_ID,
    staff_name:  staffName,
    action:      'entity.hard_deleted',
    entity_type: params.type,
    entity_id:   params.id,
    severity:    'critical',
  }).then(() => {})

  return NextResponse.json({ ok: true })
}
