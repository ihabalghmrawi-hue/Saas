import { createClient } from '@/lib/supabase/server'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { AnomaliesClient } from './anomalies-client'

export const dynamic = 'force-dynamic'

export default async function AnomaliesPage() {
  const company_id = await getCompanyId()
  const currency = await getCurrency()

  return (
    <AnomaliesClient
      company_id={company_id}
      currency={currency}
    />
  )
}
