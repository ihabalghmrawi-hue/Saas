import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  collectBackupData, uploadBackup, buildStoragePath,
  BUCKET,
} from '@/lib/backup-engine'
import { getCompanyId } from '@/lib/tenant'

const BUSINESS_TYPE = process.env.NEXT_PUBLIC_BUSINESS_TYPE || 'retail'

export async function POST(req: NextRequest) {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()
  const body     = await req.json().catch(() => ({}))
  const label    = body.label as string | undefined
  const type     = (body.type as 'manual' | 'auto') || 'manual'

  const now       = new Date()
  const dateStr   = now.toISOString().slice(0, 10)
  const timeStr   = now.toTimeString().slice(0, 5).replace(':', '-')
  const snapLabel = label || `${type === 'auto' ? 'تلقائي' : 'يدوي'} - ${dateStr} ${timeStr}`
  const path      = buildStoragePath(COMPANY_ID, `${dateStr}_${timeStr}_${type}`, 'json')

  // Insert a pending record first so we have an ID
  const { data: snap, error: insertErr } = await supabase
    .from('backup_snapshots')
    .insert({
      company_id:   COMPANY_ID,
      label:        snapLabel,
      type,
      format:       'json',
      storage_path: path,
      status:       'pending',
    })
    .select('id')
    .single()

  if (insertErr || !snap) {
    return NextResponse.json({ error: 'فشل إنشاء سجل النسخة الاحتياطية' }, { status: 500 })
  }

  try {
    // Collect data
    const payload     = await collectBackupData(COMPANY_ID, BUSINESS_TYPE)
    const json        = JSON.stringify(payload, null, 2)
    const sizeBytes   = new TextEncoder().encode(json).length

    // Upload to storage
    const { error: uploadErr } = await uploadBackup(path, json, 'application/json')
    if (uploadErr) {
      await supabase.from('backup_snapshots').update({ status: 'failed', error_message: uploadErr }).eq('id', snap.id)
      return NextResponse.json({ error: uploadErr }, { status: 500 })
    }

    // Mark ready
    await supabase.from('backup_snapshots').update({
      status:       'ready',
      file_size:    sizeBytes,
      table_counts: payload.table_counts,
    }).eq('id', snap.id)

    return NextResponse.json({ id: snap.id, label: snapLabel, size: sizeBytes, counts: payload.table_counts })

  } catch (err: any) {
    await supabase.from('backup_snapshots')
      .update({ status: 'failed', error_message: err?.message || 'خطأ غير معروف' })
      .eq('id', snap.id)
    return NextResponse.json({ error: err?.message || 'خطأ داخلي' }, { status: 500 })
  }
}
