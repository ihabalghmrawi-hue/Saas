import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const companyId = await getCompanyId()
  const supabase  = createClient()
  const { data, error } = await supabase
    .from('warehouses')
    .select('*, inventory(id)')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const companyId = await getCompanyId()
  const admin     = createAdminClient()
  const body      = await req.json()

  if (!body.name) return NextResponse.json({ error: 'اسم المخزن مطلوب' }, { status: 400 })

  // If this will be default, unset others first
  if (body.is_default) {
    await admin.from('warehouses').update({ is_default: false }).eq('company_id', companyId)
  }

  const { data, error } = await admin.from('warehouses').insert({
    company_id: companyId,
    name:       body.name.trim(),
    name_ar:    body.name_ar?.trim() || null,
    is_default: body.is_default ?? false,
    is_active:  true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ action: 'settings.updated', entityType: 'warehouse', entityId: data.id, newValue: { name: body.name } })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const companyId = await getCompanyId()
  const admin     = createAdminClient()
  const body      = await req.json()
  const { id, ...update } = body

  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })

  if (update.is_default) {
    await admin.from('warehouses').update({ is_default: false }).eq('company_id', companyId).neq('id', id)
  }

  const { data, error } = await admin.from('warehouses')
    .update(update)
    .eq('id', id).eq('company_id', companyId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const companyId = await getCompanyId()
  const admin     = createAdminClient()
  const { id }    = await req.json()

  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })

  // Soft delete
  const { error } = await admin.from('warehouses')
    .update({ is_active: false })
    .eq('id', id).eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
