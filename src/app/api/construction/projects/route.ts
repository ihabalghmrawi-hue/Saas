import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = await getCompanyId()
  const status    = req.nextUrl.searchParams.get('status')

  let q = admin.from('con_projects')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = await getCompanyId()
  const body      = await req.json()

  const { data, error } = await admin.from('con_projects').insert({
    company_id:     companyId,
    name:           String(body.name || ''),
    client_name:    String(body.client_name || ''),
    client_phone:   body.client_phone   || null,
    location:       body.location       || null,
    description:    body.description    || null,
    type:           body.type           || 'apartment',
    status:         body.status         || 'planning',
    engineer_name:  body.engineer_name  || null,
    start_date:     body.start_date     || null,
    end_date:       body.end_date       || null,
    expected_cost:  Number(body.expected_cost)  || 0,
    contract_value: Number(body.contract_value) || 0,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
