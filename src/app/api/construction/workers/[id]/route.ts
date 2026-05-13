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

  if ('name' in body) {
    allowed.name = String(body.name)
  }

  if ('job_type' in body) {
    allowed.job_type = String(body.job_type)
  }

  if ('daily_rate' in body) {
    allowed.daily_rate = Number(body.daily_rate) || 0
  }

  if ('phone' in body) {
    allowed.phone = body.phone || null
  }

  if ('status' in body) {
    allowed.status = String(body.status)
  }

  if ('rating' in body) {
    allowed.rating = Math.min(
      5,
      Math.max(0, Number(body.rating))
    )
  }

  if ('notes' in body) {
    allowed.notes = body.notes || null
  }

  const { data, error } = await admin
    .from('con_workers')
    .update({
      ...allowed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
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
    .from('con_workers')
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