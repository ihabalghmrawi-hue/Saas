import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'

export async function GET() {
  const admin     = createAdminClient()
  const companyId = getCompanyId()
  const { data, error } = await admin.from('con_workers')
    .select('*').eq('company_id', companyId).order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = getCompanyId()
  const body      = await req.json()

  const { data, error } = await admin.from('con_workers').insert({
    company_id: companyId,
    name:       String(body.name || ''),
    job_type:   body.job_type  || 'general',
    daily_rate: Number(body.daily_rate) || 0,
    phone:      body.phone     || null,
    status:     body.status    || 'available',
    rating:     Number(body.rating) || 5.0,
    notes:      body.notes     || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
