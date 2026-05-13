import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = await getCompanyId()
  const projectId = req.nextUrl.searchParams.get('project_id')

  let q = admin.from('con_materials')
    .select('*, con_projects(name)')
    .eq('company_id', companyId)
    .order('purchase_date', { ascending: false })

  if (projectId) q = q.eq('project_id', projectId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = await getCompanyId()
  const body      = await req.json()

  const { data, error } = await admin.from('con_materials').insert({
    company_id:    companyId,
    project_id:    body.project_id    || null,
    name:          String(body.name || ''),
    supplier:      body.supplier      || null,
    unit:          body.unit          || 'unit',
    quantity:      Number(body.quantity)   || 0,
    unit_price:    Number(body.unit_price) || 0,
    purchase_date: body.purchase_date || new Date().toISOString().slice(0, 10),
    notes:         body.notes         || null,
  }).select('*, con_projects(name)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
