import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const COMPANY_ID = await getCompanyId()
  const supabase   = createClient()
  const { data } = await supabase.from('branding').select('*').eq('company_id', COMPANY_ID).maybeSingle()
  return NextResponse.json(data || {})
}

export async function POST(req: NextRequest) {
  const COMPANY_ID = await getCompanyId()
  const body       = await req.json()
  const admin      = createAdminClient()

  const { data, error } = await admin.from('branding').upsert({
    company_id: COMPANY_ID,
    ...body,
    updated_at: new Date().toISOString(),
  }).select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ action: 'branding.updated', entityType: 'branding', entityId: COMPANY_ID })

  return NextResponse.json(data || {})
}
