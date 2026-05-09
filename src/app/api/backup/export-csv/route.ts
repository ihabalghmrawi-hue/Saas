// Export a single table as CSV (streamed as download)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rowsToCSV, BACKUP_TABLES } from '@/lib/backup-engine'
import type { BackupTable } from '@/lib/backup-engine'
import { getCompanyId } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const COMPANY_ID = getCompanyId()
  const table = req.nextUrl.searchParams.get('table') as BackupTable | null

  if (!table || !BACKUP_TABLES.includes(table as any)) {
    return NextResponse.json({ error: 'اسم الجدول غير صالح' }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await (supabase.from(table) as any)
    .select('*')
    .eq('company_id', COMPANY_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const csv = rowsToCSV(data || [])

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${table}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
