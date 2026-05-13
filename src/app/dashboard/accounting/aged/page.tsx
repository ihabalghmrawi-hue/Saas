import { createClient } from '@/lib/supabase/server'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { AgedClient } from './aged-client'

export const dynamic = 'force-dynamic'

export default async function AgedPage() {
  const supabase = createClient()
  const company_id = await getCompanyId()
  const currency = await getCurrency()

  return (
    <AgedClient
      company_id={company_id}
      currency={currency}
    />
  )
}
