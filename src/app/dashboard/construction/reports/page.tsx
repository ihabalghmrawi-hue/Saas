import { getCurrency } from '@/lib/tenant'
import { ConstructionReportsClient } from './reports-client'

export const dynamic = 'force-dynamic'

export default function ConstructionReportsPage() {
  const currency = getCurrency()
  return <ConstructionReportsClient currency={currency} />
}
