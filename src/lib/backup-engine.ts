// ─── Backup Engine ────────────────────────────────────────────────────────────
// Collects, validates, restores, and serialises company data.

import { createClient } from '@/lib/supabase/server'

export const BACKUP_VERSION = '1.0'
export const BUCKET = 'company-backups'

// Tables backed up in FK-safe dependency order
export const BACKUP_TABLES = [
  // Reference / master data first
  'product_categories',
  'units',
  'warehouses',
  'expense_categories',
  // Main entities
  'products',
  'product_variants',
  'inventory',
  'customers',
  'suppliers',
  // Transactional
  'sales',
  'sale_items',
  'sale_payments',
  'purchases',
  'purchase_items',
  'purchase_payments',
  'expenses',
  // Rental module (isolated, no FK to above)
  'dresses',
  'rental_orders',
  'rental_pricing_rules',
] as const

export type BackupTable = typeof BACKUP_TABLES[number]

// Tables that join on company_id directly
const COMPANY_ID_TABLES: BackupTable[] = [
  'product_categories', 'units', 'warehouses', 'expense_categories',
  'products', 'customers', 'suppliers',
  'sales', 'purchases', 'expenses',
  'dresses', 'rental_pricing_rules',
]

// Tables that join via parent FK (no company_id column of their own)
const CHILD_TABLES: Record<string, { parent: string; fk: string }> = {
  product_variants: { parent: 'products',   fk: 'product_id' },
  inventory:        { parent: 'products',   fk: 'product_id' },
  sale_items:       { parent: 'sales',      fk: 'sale_id' },
  sale_payments:    { parent: 'sales',      fk: 'sale_id' },
  purchase_items:   { parent: 'purchases',  fk: 'purchase_id' },
  purchase_payments:{ parent: 'purchases',  fk: 'purchase_id' },
  rental_orders:    { parent: 'dresses',    fk: 'company_id' }, // rental_orders has company_id
}

export interface BackupPayload {
  version:       string
  app:           string
  company_id:    string
  business_type: string
  created_at:    string
  tables:        Partial<Record<BackupTable, unknown[]>>
  table_counts:  Partial<Record<BackupTable, number>>
}

export interface ValidationResult {
  valid:    boolean
  errors:   string[]
  warnings: string[]
  counts:   Partial<Record<BackupTable, number>>
}

// ── Collect ────────────────────────────────────────────────────────────────────
export async function collectBackupData(
  companyId: string,
  businessType: string,
): Promise<BackupPayload> {
  const supabase = createClient()
  const tables: Partial<Record<BackupTable, unknown[]>> = {}
  const counts:  Partial<Record<BackupTable, number>>   = {}

  // Gather parent IDs for child-table queries
  let productIds:  string[] = []
  let saleIds:     string[] = []
  let purchaseIds: string[] = []
  let rentalCompanyId = companyId  // rental_orders uses company_id

  for (const table of BACKUP_TABLES) {
    // Skip rental tables for non-rental businesses
    const isRentalTable = ['dresses', 'rental_orders', 'rental_pricing_rules'].includes(table)
    if (isRentalTable && businessType !== 'dress_rental') {
      tables[table] = []
      counts[table] = 0
      continue
    }
    // Skip sales/inventory tables for rental businesses
    const isSalesTable = ['products', 'product_categories', 'product_variants',
      'units', 'warehouses', 'inventory', 'sale_items', 'sale_payments',
      'purchase_items', 'purchase_payments', 'sales', 'purchases'].includes(table)
    if (isSalesTable && businessType === 'dress_rental') {
      tables[table] = []
      counts[table] = 0
      continue
    }

    let query: any

    if (COMPANY_ID_TABLES.includes(table as any)) {
      query = supabase.from(table).select('*').eq('company_id', companyId)
    } else if (table === 'rental_orders') {
      query = supabase.from(table).select('*').eq('company_id', companyId)
    } else if (table === 'product_variants' && productIds.length > 0) {
      query = supabase.from(table).select('*').in('product_id', productIds)
    } else if (table === 'inventory' && productIds.length > 0) {
      query = supabase.from(table).select('*').eq('company_id', companyId).in('product_id', productIds)
    } else if (table === 'sale_items' && saleIds.length > 0) {
      query = supabase.from(table).select('*').in('sale_id', saleIds)
    } else if (table === 'sale_payments' && saleIds.length > 0) {
      query = supabase.from(table).select('*').in('sale_id', saleIds)
    } else if (table === 'purchase_items' && purchaseIds.length > 0) {
      query = supabase.from(table).select('*').in('purchase_id', purchaseIds)
    } else if (table === 'purchase_payments' && purchaseIds.length > 0) {
      query = supabase.from(table).select('*').in('purchase_id', purchaseIds)
    } else {
      tables[table] = []
      counts[table] = 0
      continue
    }

    const { data, error } = await query
    if (error) {
      console.error(`Backup: failed to fetch ${table}:`, error.message)
      tables[table] = []
      counts[table] = 0
      continue
    }

    tables[table] = data || []
    counts[table] = data?.length ?? 0

    // Cache IDs for child queries
    if (table === 'products')  productIds  = (data || []).map((r: any) => r.id)
    if (table === 'sales')     saleIds     = (data || []).map((r: any) => r.id)
    if (table === 'purchases') purchaseIds = (data || []).map((r: any) => r.id)
  }

  return {
    version:      BACKUP_VERSION,
    app:          'financeapp',
    company_id:   companyId,
    business_type: businessType,
    created_at:   new Date().toISOString(),
    tables,
    table_counts: counts,
  }
}

// ── Validate ──────────────────────────────────────────────────────────────────
export function validateBackupPayload(raw: unknown): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []
  const counts:   Partial<Record<BackupTable, number>> = {}

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['الملف ليس بصيغة JSON صحيحة'], warnings, counts }
  }

  const payload = raw as any

  if (payload.app !== 'financeapp') {
    errors.push('الملف لا ينتمي لهذا التطبيق')
  }
  if (!payload.version) {
    errors.push('حقل version مفقود')
  }
  if (payload.version !== BACKUP_VERSION) {
    warnings.push(`إصدار النسخة الاحتياطية (${payload.version}) يختلف عن الإصدار الحالي (${BACKUP_VERSION})`)
  }
  if (!payload.company_id) {
    errors.push('حقل company_id مفقود')
  }
  if (!payload.tables || typeof payload.tables !== 'object') {
    errors.push('حقل tables مفقود أو تالف')
    return { valid: errors.length === 0, errors, warnings, counts }
  }

  for (const table of BACKUP_TABLES) {
    const rows = payload.tables[table]
    if (!Array.isArray(rows)) {
      warnings.push(`جدول ${table} غير موجود في الملف — سيتم تخطيه`)
      counts[table] = 0
    } else {
      counts[table] = rows.length
    }
  }

  return { valid: errors.length === 0, errors, warnings, counts }
}

// ── Restore ───────────────────────────────────────────────────────────────────
export interface RestoreResult {
  success: boolean
  restored: Partial<Record<BackupTable, number>>
  errors:   string[]
}

export async function restoreBackupData(
  payload: BackupPayload,
  targetCompanyId: string,
): Promise<RestoreResult> {
  const supabase = createClient()
  const restored: Partial<Record<BackupTable, number>> = {}
  const errors:   string[] = []

  for (const table of BACKUP_TABLES) {
    const rows = payload.tables[table]
    if (!rows || rows.length === 0) {
      restored[table] = 0
      continue
    }

    // Re-stamp company_id so cross-company restores are safe
    const stamped = rows.map((row: any) => ({
      ...row,
      company_id: COMPANY_ID_TABLES.includes(table as any) || table === 'rental_orders'
        ? targetCompanyId
        : row.company_id,
    }))

    // Upsert in chunks of 500 to stay within Supabase payload limits
    const CHUNK = 500
    let count = 0
    for (let i = 0; i < stamped.length; i += CHUNK) {
      const chunk = stamped.slice(i, i + CHUNK)
      const { error } = await (supabase.from(table) as any)
        .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false })
      if (error) {
        errors.push(`${table}: ${error.message}`)
        break
      }
      count += chunk.length
    }
    restored[table] = count
  }

  return { success: errors.length === 0, restored, errors }
}

// ── CSV export ────────────────────────────────────────────────────────────────
export function rowsToCSV(rows: unknown[]): string {
  if (!rows || rows.length === 0) return ''
  const headers = Object.keys(rows[0] as object)
  const escape  = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [
    headers.join(','),
    ...rows.map((row: any) => headers.map(h => escape(row[h])).join(',')),
  ]
  return lines.join('\n')
}

// ── Storage helpers ───────────────────────────────────────────────────────────
export function buildStoragePath(companyId: string, label: string, format: 'json' | 'csv'): string {
  const safe = label.replace(/[^a-zA-Z0-9؀-ۿ._-]/g, '_')
  return `${companyId}/${safe}.${format}`
}

export async function uploadBackup(
  path: string,
  content: string,
  contentType: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const bytes    = new TextEncoder().encode(content)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true })
  return { error: error?.message ?? null }
}

export async function downloadBackup(path: string): Promise<{ data: string | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) return { data: null, error: error?.message ?? 'فشل التحميل' }
  return { data: await data.text(), error: null }
}

export async function deleteBackupFile(path: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  return { error: error?.message ?? null }
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  return data?.signedUrl ?? null
}
