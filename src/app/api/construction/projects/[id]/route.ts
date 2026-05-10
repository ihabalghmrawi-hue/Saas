import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const admin     = createAdminClient()
  const companyId = getCompanyId()

  const [{ data: project }, { data: tasks }, { data: expenses }, { data: payments }, { data: files }] = await Promise.all([
    admin.from('con_projects').select('*').eq('id', params.id).eq('company_id', companyId).single(),
    admin.from('con_tasks').select('*, con_workers(name, job_type)').eq('project_id', params.id),
    admin.from('con_expenses').select('*').eq('project_id', params.id).order('expense_date', { ascending: false }),
    admin.from('con_payments').select('*').eq('project_id', params.id).order('payment_date', { ascending: false }),
    admin.from('con_files').select('*').eq('project_id', params.id).order('uploaded_at', { ascending: false }),
  ])

  if (!project) return NextResponse.json({ error: 'المشروع غير موجود' }, { status: 404 })

  return NextResponse.json({ project, tasks: tasks || [], expenses: expenses || [], payments: payments || [], files: files || [] })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin     = createAdminClient()
  const companyId = getCompanyId()
  const body      = await req.json()

  const allowed: Record<string, unknown> = {}
  if ('name' in body)           allowed.name           = String(body.name)
  if ('client_name' in body)    allowed.client_name    = String(body.client_name)
  if ('client_phone' in body)   allowed.client_phone   = body.client_phone || null
  if ('location' in body)       allowed.location       = body.location || null
  if ('description' in body)    allowed.description    = body.description || null
  if ('type' in body)           allowed.type           = String(body.type)
  if ('status' in body)         allowed.status         = String(body.status)
  if ('engineer_name' in body)  allowed.engineer_name  = body.engineer_name || null
  if ('start_date' in body)     allowed.start_date     = body.start_date || null
  if ('end_date' in body)       allowed.end_date       = body.end_date || null
  if ('expected_cost' in body)  allowed.expected_cost  = Number(body.expected_cost) || 0
  if ('contract_value' in body) allowed.contract_value = Number(body.contract_value) || 0

  const { data, error } = await admin.from('con_projects')
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq('id', params.id).eq('company_id', companyId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const admin     = createAdminClient()
  const companyId = getCompanyId()
  const { error } = await admin.from('con_projects').delete().eq('id', params.id).eq('company_id', companyId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
