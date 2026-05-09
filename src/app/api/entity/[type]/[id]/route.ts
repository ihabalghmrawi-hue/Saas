// DELETE  /api/entity/:type/:id  — soft delete any entity
// GET     /api/entity/:type/:id  — fetch entity + dependency info
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getEntity } from '@/lib/entity-registry'
import { softDelete, checkDependencies } from '@/lib/data-lifecycle'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

type Ctx = { params: { type: string; id: string } }

// GET — preview dependencies before deleting
export async function GET(_req: NextRequest, { params }: Ctx) {
  const COMPANY_ID = getCompanyId()
  const meta = getEntity(params.type)
  if (!meta) return NextResponse.json({ error: 'نوع الكيان غير معروف' }, { status: 400 })

  const supabase = createClient()

  const { data: row } = await (supabase.from(meta.table) as any)
    .select('*')
    .eq('id', params.id)
    .eq(meta.companyField, COMPANY_ID)
    .single()

  if (!row) return NextResponse.json({ error: 'العنصر غير موجود' }, { status: 404 })

  const deps = await checkDependencies(meta, params.id, COMPANY_ID)

  return NextResponse.json({
    entity: row,
    name: row[meta.nameField] || '—',
    labelArSing: meta.labelArSing,
    dependencies: deps,
    canDelete: deps.every(d => !d.blocks),
  })
}

// DELETE — soft delete
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const COMPANY_ID = getCompanyId()
  const h         = headers()
  const deletedBy = h.get('x-staff-name') || 'system'

  const result = await softDelete(params.type, params.id, COMPANY_ID, deletedBy)

  if (result.blocked) {
    return NextResponse.json(
      { error: 'لا يمكن الحذف — يوجد بيانات مرتبطة', dependencies: result.dependencies },
      { status: 409 },
    )
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'نوع الكيان غير معروف' ? 400 : 500 })
  }

  // Audit
  const supabase = createClient()
  await supabase.from('audit_logs').insert({
    company_id:  COMPANY_ID,
    staff_name:  deletedBy,
    action:      'entity.deleted',
    entity_type: params.type,
    entity_id:   params.id,
    severity:    'warning',
  }).then(() => {})

  return NextResponse.json({ ok: true })
}
