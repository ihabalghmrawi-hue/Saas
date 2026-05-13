import { z } from 'zod'

export const CreateWarehouseSchema = z.object({
  code: z.string().min(1, 'رمز المستودع مطلوب').max(20, 'الرمز لا يتجاوز 20 حرفاً'),
  name: z.string().min(1, 'اسم المستودع مطلوب').max(200),
  name_ar: z.string().max(200).optional(),
  type: z.enum(['physical', 'virtual', 'transit', 'consignment']).default('physical'),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  is_default: z.boolean().default(false),
  branch_id: z.string().uuid().optional(),
  manager_id: z.string().uuid().optional(),
  contact_phone: z.string().max(30).optional(),
  contact_email: z.string().email().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const CreateLocationSchema = z.object({
  warehouse_id: z.string().uuid('المستودع غير صحيح'),
  code: z.string().min(1, 'رمز الموقع مطلوب'),
  name: z.string().max(200).optional(),
  name_ar: z.string().max(200).optional(),
  type: z.enum(['receiving', 'storage', 'picking', 'shipping', 'quarantine', 'damaged', 'return']).default('storage'),
  is_pickable: z.boolean().default(true),
  max_weight: z.number().positive().optional(),
  max_volume: z.number().positive().optional(),
  zone: z.string().max(50).optional(),
  aisle: z.string().max(50).optional(),
  rack: z.string().max(50).optional(),
  shelf: z.string().max(50).optional(),
  barcode: z.string().max(100).optional(),
  parent_location_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const TransferSchema = z.object({
  from_warehouse_id: z.string().uuid('مستودع المصدر مطلوب'),
  to_warehouse_id: z.string().uuid('مستودع الوجهة مطلوب'),
  from_branch_id: z.string().uuid().optional(),
  to_branch_id: z.string().uuid().optional(),
  type: z.enum(['internal', 'inter_branch', 'return', 'direct']).default('internal'),
  requested_by: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
  notes_ar: z.string().max(1000).optional(),
  expected_delivery_date: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  lines: z.array(z.object({
    item_id: z.string().uuid('الصنف مطلوب'),
    variant_id: z.string().uuid().optional(),
    batch_id: z.string().uuid().optional(),
    from_location_id: z.string().uuid().optional(),
    to_location_id: z.string().uuid().optional(),
    qty: z.number().positive('الكمية يجب أن تكون أكبر من صفر'),
    notes: z.string().max(500).optional(),
  })).min(1, 'يجب إضافة بند واحد على الأقل'),
})
