import { createClient } from '@/lib/supabase/server'
import { BackupClient } from './backup-client'
import { BACKUP_TABLES } from '@/lib/backup-engine'
import { getCompanyId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function BackupPage() {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const { data: snapshots } = await supabase
    .from('backup_snapshots')
    .select('id, label, type, format, file_size, table_counts, status, error_message, created_at, expires_at')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <BackupClient
      initialSnapshots={snapshots || []}
      availableTables={[...BACKUP_TABLES]}
    />
  )
}
