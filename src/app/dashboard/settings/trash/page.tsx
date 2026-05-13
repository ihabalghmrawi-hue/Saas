import { listTrash } from '@/lib/data-lifecycle'
import { TrashClient } from './trash-client'
import { ENTITY_MODULES } from '@/lib/entity-registry'
import { getCompanyId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function TrashPage() {
  const COMPANY_ID = await getCompanyId()
  const items = await listTrash(COMPANY_ID)
  return <TrashClient initialItems={items} modules={ENTITY_MODULES} />
}
