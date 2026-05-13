// DELETE  /api/entity/:type/:id  — soft delete any entity
// GET     /api/entity/:type/:id  — fetch entity + dependency info

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getEntity } from '@/lib/entity-registry'
import { softDelete, checkDependencies } from '@/lib/data-lifecycle'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

// GET — preview dependencies before deleting
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await context.params

  const COMPANY_ID = await getCompanyId()

  const meta = getEntity(type)

  if (!meta) {
    return NextResponse.json(
      { error: 'نوع الكيان غير معروف' },
      { status: 400 }
    )
  }

  const supabase = createClient()

  const { data: row } = await (supabase.from(meta.table) as any)
    .select('*')
    .eq('id', id)
    .eq(meta.companyField, COMPANY_ID)
    .single()

  if (!row) {
    return NextResponse.json(
      { error: 'العنصر غير موجود' },
      { status: 404 }
    )
  }

  const deps = await checkDependencies(
    meta,
    id,
    COMPANY_ID
  )

  return NextResponse.json({
    entity: row,
    name: row[meta.nameField] || '—',
    labelArSing: meta.labelArSing,
    dependencies: deps,
    canDelete: deps.every((d: any) => !d.blocks),
  })
}

// DELETE — soft delete
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await context.params

  const COMPANY_ID = await getCompanyId()

  const h = await headers()

  const deletedBy =
    h.get('x-staff-name') || 'system'

  const result = await softDelete(
    type,
    id,
    COMPANY_ID,
    deletedBy
  )

  if (result.blocked) {
    return NextResponse.json(
      {
        error: 'لا يمكن الحذف — يوجد بيانات مرتبطة',
        dependencies: result.dependencies,
      },
      { status: 409 }
    )
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      {
        status:
          result.error === 'نوع الكيان غير معروف'
            ? 400
            : 500,
      }
    )
  }

  // Audit
  const supabase = createClient()

  await supabase
    .from('audit_logs')
    .insert({
      company_id: COMPANY_ID,
      staff_name: deletedBy,
      action: 'entity.deleted',
      entity_type: type,
      entity_id: id,
      severity: 'warning',
    })
    .then(() => {})

  return NextResponse.json({ ok: true })
}