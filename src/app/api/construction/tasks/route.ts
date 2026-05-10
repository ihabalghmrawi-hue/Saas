import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const admin      = createAdminClient()
  const companyId  = getCompanyId()
  const projectId  = req.nextUrl.searchParams.get('project_id')

  let q = admin.from('con_tasks')
    .select('*, con_workers(name, job_type), con_projects(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (projectId) q = q.eq('project_id', projectId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = getCompanyId()
  const body      = await req.json()

  const { data, error } = await admin.from('con_tasks').insert({
    company_id:  companyId,
    project_id:  body.project_id,
    worker_id:   body.worker_id   || null,
    title:       String(body.title || ''),
    description: body.description || null,
    status:      body.status      || 'todo',
    priority:    body.priority    || 'medium',
    progress:    Number(body.progress) || 0,
    start_date:  body.start_date  || null,
    due_date:    body.due_date    || null,
  }).select('*, con_workers(name, job_type)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
