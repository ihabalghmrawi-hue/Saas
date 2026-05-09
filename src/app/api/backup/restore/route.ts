import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  downloadBackup, validateBackupPayload, restoreBackupData,
} from '@/lib/backup-engine'
import type { BackupPayload } from '@/lib/backup-engine'
import { getCompanyId } from '@/lib/tenant'

export async function POST(req: NextRequest) {
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()
  const body     = await req.json().catch(() => ({}))

  // Two restore modes: from snapshot ID or from uploaded JSON text
  const { snapshot_id, json_text } = body as {
    snapshot_id?: string
    json_text?:   string
  }

  let rawPayload: unknown

  if (snapshot_id) {
    // Fetch from Supabase storage
    const { data: snap } = await supabase
      .from('backup_snapshots')
      .select('storage_path, status')
      .eq('id', snapshot_id)
      .eq('company_id', COMPANY_ID)
      .single()

    if (!snap) return NextResponse.json({ error: 'النسخة غير موجودة' }, { status: 404 })
    if (snap.status !== 'ready') return NextResponse.json({ error: 'النسخة غير جاهزة للاستعادة' }, { status: 400 })

    // Mark as restoring
    await supabase.from('backup_snapshots').update({ status: 'restoring' }).eq('id', snapshot_id)

    const { data: text, error: dlErr } = await downloadBackup(snap.storage_path)
    if (dlErr || !text) {
      await supabase.from('backup_snapshots').update({ status: 'ready' }).eq('id', snapshot_id)
      return NextResponse.json({ error: dlErr || 'فشل تحميل الملف' }, { status: 500 })
    }

    try { rawPayload = JSON.parse(text) } catch {
      await supabase.from('backup_snapshots').update({ status: 'ready' }).eq('id', snapshot_id)
      return NextResponse.json({ error: 'الملف تالف أو غير صالح' }, { status: 400 })
    }
  } else if (json_text) {
    try { rawPayload = JSON.parse(json_text) } catch {
      return NextResponse.json({ error: 'نص JSON غير صالح' }, { status: 400 })
    }
  } else {
    return NextResponse.json({ error: 'يجب توفير snapshot_id أو json_text' }, { status: 400 })
  }

  // Validate
  const validation = validateBackupPayload(rawPayload)
  if (!validation.valid) {
    if (snapshot_id) await supabase.from('backup_snapshots').update({ status: 'ready' }).eq('id', snapshot_id)
    return NextResponse.json({ error: 'ملف النسخة الاحتياطية غير صالح', details: validation.errors }, { status: 422 })
  }

  // Restore
  const result = await restoreBackupData(rawPayload as BackupPayload, COMPANY_ID)

  // Reset snapshot status back to ready
  if (snapshot_id) {
    await supabase.from('backup_snapshots').update({ status: 'ready' }).eq('id', snapshot_id)
  }

  if (!result.success) {
    return NextResponse.json(
      { error: 'اكتملت الاستعادة مع بعض الأخطاء', errors: result.errors, restored: result.restored },
      { status: 207 },
    )
  }

  return NextResponse.json({ ok: true, restored: result.restored, warnings: validation.warnings })
}
