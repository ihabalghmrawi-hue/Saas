import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'
import { recordInventoryMovement, type MovementType } from '@/lib/inventory'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const admin     = createAdminClient()
  const companyId = getCompanyId()
  const body      = await req.json()

  const { product_id, warehouse_id, type, quantity, notes } = body

  if (!product_id)  return NextResponse.json({ error: 'المنتج مطلوب' },    { status: 400 })
  if (!warehouse_id)return NextResponse.json({ error: 'المستودع مطلوب' }, { status: 400 })
  if (!type)        return NextResponse.json({ error: 'نوع الحركة مطلوب' }, { status: 400 })
  if (!quantity || quantity <= 0) return NextResponse.json({ error: 'الكمية يجب أن تكون أكبر من صفر' }, { status: 400 })

  const validTypes: MovementType[] = ['adjustment', 'opening', 'transfer_in', 'transfer_out']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: `نوع غير صالح: ${type}` }, { status: 400 })
  }

  const result = await recordInventoryMovement(admin, {
    company_id: companyId,
    product_id,
    warehouse_id,
    type,
    quantity,
    reference_type: 'manual',
    notes: notes || null,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  await logAudit({
    action:     'inventory.adjusted',
    entityType: 'inventory',
    entityId:   product_id,
    newValue:   { type, quantity, warehouse_id, notes },
  })

  return NextResponse.json({ ok: true, quantity_after: result.quantity_after })
}
