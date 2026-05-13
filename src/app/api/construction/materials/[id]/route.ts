import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'

export async function DELETE(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const admin = createAdminClient()
  const companyId = await getCompanyId()

  const { error } = await admin
    .from('con_materials')
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