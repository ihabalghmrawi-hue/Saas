import { createClient } from '@/lib/supabase/server'
import { PartiesClient } from './parties-client'

export const dynamic = 'force-dynamic'

export default async function PartiesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('company_id, companies(currency)')
    .eq('user_id', user!.id)
    .single()

  const companyId = membership?.company_id as string
  const currency = (membership?.companies as any)?.currency || 'USD'

  const { data: parties } = await supabase
    .from('parties')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')

  return <PartiesClient parties={parties || []} companyId={companyId} currency={currency} />
}
