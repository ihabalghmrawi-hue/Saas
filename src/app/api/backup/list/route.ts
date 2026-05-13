import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function GET() {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('backup_snapshots')
    .select('id, label, type, format, file_size, table_counts, status, error_message, created_at, expires_at')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
