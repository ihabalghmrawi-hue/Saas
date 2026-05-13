import { getCurrency } from '@/lib/tenant'
import { ConstructionReportsClient } from './reports-client'

export const dynamic = 'force-dynamic'

export default async function ConstructionReportsPage() {
  const currency = await getCurrency()
  return <ConstructionReportsClient currency={currency} />
}
