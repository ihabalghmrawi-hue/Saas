import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedUrl } from '@/lib/backup-engine'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()

  const { data: snap } = await supabase
    .from('backup_snapshots')
    .select('storage_path, label, format, status')
    .eq('id', params.id)
    .eq('company_id', COMPANY_ID)
    .single()

  if (!snap) return NextResponse.json({ error: 'النسخة غير موجودة' }, { status: 404 })
  if (snap.status !== 'ready') return NextResponse.json({ error: 'النسخة غير جاهزة' }, { status: 400 })

  const url = await getSignedUrl(snap.storage_path, 300) // 5-minute link
  if (!url) return NextResponse.json({ error: 'فشل إنشاء رابط التحميل' }, { status: 500 })

  return NextResponse.json({ url, filename: `${snap.label}.${snap.format}` })
}
