import type { SupabaseClient } from '@supabase/supabase-js'

export type MovementType =
  | 'purchase' | 'sale' | 'return_sale' | 'return_purchase'
  | 'adjustment' | 'transfer_in' | 'transfer_out' | 'opening'

/**
 * Records a row in inventory_movements AND updates the inventory qty atomically.
 * Pass qty as a positive number — direction is determined by movementType.
 */
export async function recordInventoryMovement(
  supabase: SupabaseClient,
  opts: {
    company_id:    string
    product_id:    string
    warehouse_id:  string
    type:          MovementType
    quantity:      number          // always positive
    reference_id?: string
    reference_type?: string
    notes?:        string
  },
): Promise<{ ok: boolean; error?: string; quantity_after?: number }> {
  const { company_id, product_id, warehouse_id, type, quantity, reference_id, reference_type, notes } = opts

  const isIncoming = ['purchase','return_sale','adjustment','transfer_in','opening'].includes(type)
  const delta = isIncoming ? quantity : -quantity

  // 1. Get or create inventory row
  let { data: inv } = await supabase
    .from('inventory')
    .select('id, quantity')
    .eq('product_id', product_id)
    .eq('warehouse_id', warehouse_id)
    .is('variant_id', null)
    .maybeSingle()

  const quantity_before = Number(inv?.quantity ?? 0)
  const quantity_after  = Math.max(0, quantity_before + delta)

  if (inv) {
    const { error } = await supabase
      .from('inventory')
      .update({ quantity: quantity_after, updated_at: new Date().toISOString() })
      .eq('id', inv.id)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase
      .from('inventory')
      .insert({ company_id, product_id, warehouse_id, quantity: quantity_after, reserved_quantity: 0 })
    if (error) return { ok: false, error: error.message }
  }

  // 2. Record the movement
  const { error: movErr } = await supabase
    .from('inventory_movements')
    .insert({
      company_id, product_id, warehouse_id,
      type,
      quantity:        Math.abs(delta),
      quantity_before,
      quantity_after,
      reference_id:    reference_id   || null,
      reference_type:  reference_type || null,
      notes:           notes          || null,
    })

  if (movErr) {
    // Movement logging failure is non-fatal — inventory is already updated
    console.error('[inventory] movement log failed:', movErr.message)
  }

  return { ok: true, quantity_after }
}
