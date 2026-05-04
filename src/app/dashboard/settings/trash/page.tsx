import { listTrash } from '@/lib/data-lifecycle'
import { TrashClient } from './trash-client'
import { ENTITY_MODULES } from '@/lib/entity-registry'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export default async function TrashPage() {
  const items = await listTrash(COMPANY_ID)
  return <TrashClient initialItems={items} modules={ENTITY_MODULES} />
}
