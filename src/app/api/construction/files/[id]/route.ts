import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const admin     = createAdminClient()
  const companyId = getCompanyId()
  const { error } = await admin.from('con_files').delete().eq('id', params.id).eq('company_id', companyId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
