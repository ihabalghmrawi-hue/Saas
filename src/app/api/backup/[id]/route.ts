import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteBackupFile } from '@/lib/backup-engine'
import { getCompanyId } from '@/lib/tenant'

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const { data: snap } = await supabase
    .from('backup_snapshots')
    .select('storage_path')
    .eq('id', id)
    .eq('company_id', COMPANY_ID)
    .single()

  if (!snap) {
    return NextResponse.json(
      { error: 'النسخة غير موجودة' },
      { status: 404 }
    )
  }

  // Delete file from storage (non-fatal if file is already gone)
  await deleteBackupFile(snap.storage_path)

  const { error } = await supabase
    .from('backup_snapshots')
    .delete()
    .eq('id', id)
    .eq('company_id', COMPANY_ID)

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}