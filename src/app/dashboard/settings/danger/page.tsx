import { DangerZoneClient } from './danger-client'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function DangerZonePage() {
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()

  // Load counts so admin can see what will be deleted
  const tables = ['customers','suppliers','products','sales','purchases','expenses','dresses','rental_orders']
  const counts: Record<string, number> = {}

  await Promise.all(tables.map(async t => {
    const { count } = await (supabase.from(t) as any)
      .select('id', { count: 'exact', head: true })
      .eq('company_id', COMPANY_ID)
    counts[t] = count ?? 0
  }))

  const { data: resets } = await supabase
    .from('factory_reset_log')
    .select('confirmed_at, initiated_by, tables_cleared, backup_id')
    .eq('company_id', COMPANY_ID)
    .order('confirmed_at', { ascending: false })
    .limit(5)

  return <DangerZoneClient counts={counts} resetHistory={resets || []} />
}
