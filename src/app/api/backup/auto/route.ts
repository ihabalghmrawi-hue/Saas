// Called daily by Vercel Cron (see vercel.json).
// Protected by a shared secret to prevent unauthorized triggers.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  collectBackupData, uploadBackup, buildStoragePath,
} from '@/lib/backup-engine'
import { getCompanyId } from '@/lib/tenant'

const BUSINESS_TYPE = process.env.NEXT_PUBLIC_BUSINESS_TYPE || 'retail'
const CRON_SECRET   = process.env.CRON_SECRET               || ''

const MIN_INTERVAL_HOURS = 22 // don't run more than once per ~day

export async function POST(req: NextRequest) {
  const COMPANY_ID = getCompanyId()
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()

  // Check when the last auto backup was
  const { data: last } = await supabase
    .from('backup_snapshots')
    .select('created_at')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'auto')
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (last) {
    const hoursSinceLast = (Date.now() - new Date(last.created_at).getTime()) / 3_600_000
    if (hoursSinceLast < MIN_INTERVAL_HOURS) {
      return NextResponse.json({ skipped: true, reason: `آخر نسخة منذ ${hoursSinceLast.toFixed(1)} ساعة` })
    }
  }

  const now      = new Date()
  const dateStr  = now.toISOString().slice(0, 10)
  const timeStr  = now.toTimeString().slice(0, 5).replace(':', '-')
  const label    = `تلقائي - ${dateStr}`
  const path     = buildStoragePath(COMPANY_ID, `${dateStr}_${timeStr}_auto`, 'json')

  const { data: snap, error: insertErr } = await supabase
    .from('backup_snapshots')
    .insert({ company_id: COMPANY_ID, label, type: 'auto', format: 'json', storage_path: path, status: 'pending' })
    .select('id')
    .single()

  if (insertErr || !snap) return NextResponse.json({ error: 'فشل إنشاء السجل' }, { status: 500 })

  try {
    const payload   = await collectBackupData(COMPANY_ID, BUSINESS_TYPE)
    const json      = JSON.stringify(payload, null, 2)
    const sizeBytes = new TextEncoder().encode(json).length

    const { error: uploadErr } = await uploadBackup(path, json, 'application/json')
    if (uploadErr) {
      await supabase.from('backup_snapshots').update({ status: 'failed', error_message: uploadErr }).eq('id', snap.id)
      return NextResponse.json({ error: uploadErr }, { status: 500 })
    }

    await supabase.from('backup_snapshots').update({
      status: 'ready', file_size: sizeBytes, table_counts: payload.table_counts,
    }).eq('id', snap.id)

    // Prune old auto backups — keep last 30
    const { data: old } = await supabase
      .from('backup_snapshots')
      .select('id, storage_path')
      .eq('company_id', COMPANY_ID)
      .eq('type', 'auto')
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .range(30, 999)

    for (const o of old || []) {
      await supabase.storage.from('company-backups').remove([o.storage_path])
      await supabase.from('backup_snapshots').delete().eq('id', o.id)
    }

    return NextResponse.json({ ok: true, id: snap.id, size: sizeBytes })
  } catch (err: any) {
    await supabase.from('backup_snapshots')
      .update({ status: 'failed', error_message: err?.message })
      .eq('id', snap.id)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

// Vercel Cron also supports GET
export { POST as GET }
