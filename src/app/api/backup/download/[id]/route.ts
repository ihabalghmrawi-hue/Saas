import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedUrl } from '@/lib/backup-engine'
import { getCompanyId } from '@/lib/tenant'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const { data: snap } = await supabase
    .from('backup_snapshots')
    .select('storage_path, label, format, status')
    .eq('id', id)
    .eq('company_id', COMPANY_ID)
    .single()

  if (!snap) {
    return NextResponse.json(
      { error: 'النسخة غير موجودة' },
      { status: 404 }
    )
  }

  if (snap.status !== 'ready') {
    return NextResponse.json(
      { error: 'النسخة غير جاهزة' },
      { status: 400 }
    )
  }

  const url = await getSignedUrl(snap.storage_path, 300)

  if (!url) {
    return NextResponse.json(
      { error: 'فشل إنشاء رابط التحميل' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    url,
    filename: `${snap.label}.${snap.format}`,
  })
}