import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const admin = createAdminClient()
  const companyId = await getCompanyId()
  const body = await req.json()

  const allowed: Record<string, unknown> = {}

  if ('title' in body) {
    allowed.title = String(body.title)
  }

  if ('description' in body) {
    allowed.description = body.description || null
  }

  if ('worker_id' in body) {
    allowed.worker_id = body.worker_id || null
  }

  if ('status' in body) {
    allowed.status = String(body.status)
  }

  if ('priority' in body) {
    allowed.priority = String(body.priority)
  }

  if ('progress' in body) {
    allowed.progress = Math.min(
      100,
      Math.max(0, Number(body.progress))
    )
  }

  if ('start_date' in body) {
    allowed.start_date = body.start_date || null
  }

  if ('due_date' in body) {
    allowed.due_date = body.due_date || null
  }

  if (body.status === 'done') {
    allowed.completed_at = new Date().toISOString()
  }

  const { data, error } = await admin
    .from('con_tasks')
    .update({
      ...allowed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*, con_workers(name, job_type)')
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const admin = createAdminClient()
  const companyId = await getCompanyId()

  const { error } = await admin
    .from('con_tasks')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}