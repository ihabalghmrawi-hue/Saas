import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = getCompanyId()
  const projectId = req.nextUrl.searchParams.get('project_id')

  let q = admin.from('con_files')
    .select('*, con_projects(name)')
    .eq('company_id', companyId)
    .order('uploaded_at', { ascending: false })

  if (projectId) q = q.eq('project_id', projectId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = getCompanyId()
  const body      = await req.json()

  const { data, error } = await admin.from('con_files').insert({
    company_id:  companyId,
    project_id:  body.project_id  || null,
    name:        String(body.name || ''),
    url:         String(body.url  || ''),
    type:        body.type        || 'document',
    size_bytes:  Number(body.size_bytes) || 0,
    notes:       body.notes       || null,
  }).select('*, con_projects(name)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
