// ─── Data Lifecycle Engine ────────────────────────────────────────────────────
// Handles soft delete, restore, dependency checks, and factory reset.
// All operations are scoped to a single company_id (multi-tenant safe).

import { createClient } from '@/lib/supabase/server'
import { getEntity, ENTITY_REGISTRY, RESET_ORDER, RESET_HARD_TABLES } from '@/lib/entity-registry'
import type { EntityType, EntityMeta } from '@/lib/entity-registry'
import { collectBackupData, uploadBackup, buildStoragePath } from '@/lib/backup-engine'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Dependency {
  table:   string
  labelAr: string
  count:   number
  blocks:  boolean
}

export interface DeleteResult {
  ok:           boolean
  blocked:      boolean
  dependencies: Dependency[]
  error?:       string
}

export interface TrashItem {
  id:           string
  type:         EntityType
  module:       string
  labelAr:      string
  labelArSing:  string
  name:         string
  deleted_at:   string
  deleted_by:   string | null
  company_id:   string
}

export interface ResetResult {
  ok:      boolean
  counts:  Record<string, number>
  backupId?: string
  error?:  string
}

// ── Check dependencies before delete ─────────────────────────────────────────
export async function checkDependencies(
  meta:      EntityMeta,
  id:        string,
  companyId: string,
): Promise<Dependency[]> {
  if (!meta.blockedBy || meta.blockedBy.length === 0) return []

  const supabase = createClient()
  const deps: Dependency[] = []

  for (const dep of meta.blockedBy) {
    let q = (supabase.from(dep.table) as any).select('id', { count: 'exact', head: true }).eq(dep.fk, id)
    if (dep.activeOnly) {
      // Exclude cancelled / deleted rows
      q = q.neq('status', 'cancelled').eq('is_deleted', false)
    }
    const { count } = await q
    if ((count ?? 0) > 0) {
      deps.push({ table: dep.table, labelAr: dep.labelAr, count: count ?? 0, blocks: true })
    }
  }
  return deps
}

// ── Soft delete ───────────────────────────────────────────────────────────────
export async function softDelete(
  entityType: string,
  id:         string,
  companyId:  string,
  deletedBy:  string = 'system',
): Promise<DeleteResult> {
  const meta = getEntity(entityType)
  if (!meta) return { ok: false, blocked: false, dependencies: [], error: 'نوع الكيان غير معروف' }

  const supabase = createClient()

  // Verify ownership
  const { data: row } = await (supabase.from(meta.table) as any)
    .select('id')
    .eq('id', id)
    .eq(meta.companyField, companyId)
    .eq('is_deleted', false)
    .single()

  if (!row) return { ok: false, blocked: false, dependencies: [], error: 'العنصر غير موجود أو محذوف مسبقاً' }

  // Check blocking dependencies
  const deps = await checkDependencies(meta, id, companyId)
  const blocked = deps.some(d => d.blocks)
  if (blocked) return { ok: false, blocked: true, dependencies: deps }

  // Cascade soft-delete children
  for (const child of meta.cascadeSoftDelete ?? []) {
    await (supabase.from(child.table) as any)
      .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq(child.fk, id)
  }

  // Soft delete the entity itself
  const { error } = await (supabase.from(meta.table) as any)
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq('id', id)
    .eq(meta.companyField, companyId)

  if (error) return { ok: false, blocked: false, dependencies: deps, error: error.message }
  return { ok: true, blocked: false, dependencies: deps }
}

// ── Restore from trash ────────────────────────────────────────────────────────
export async function restoreEntity(
  entityType: string,
  id:         string,
  companyId:  string,
): Promise<{ ok: boolean; error?: string }> {
  const meta = getEntity(entityType)
  if (!meta) return { ok: false, error: 'نوع الكيان غير معروف' }

  const supabase = createClient()

  // Restore cascade children first
  for (const child of meta.cascadeSoftDelete ?? []) {
    await (supabase.from(child.table) as any)
      .update({ is_deleted: false, deleted_at: null, deleted_by: null })
      .eq(child.fk, id)
  }

  const { error } = await (supabase.from(meta.table) as any)
    .update({ is_deleted: false, deleted_at: null, deleted_by: null })
    .eq('id', id)
    .eq(meta.companyField, companyId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Hard (permanent) delete ───────────────────────────────────────────────────
export async function hardDelete(
  entityType: string,
  id:         string,
  companyId:  string,
): Promise<{ ok: boolean; error?: string }> {
  const meta = getEntity(entityType)
  if (!meta) return { ok: false, error: 'نوع الكيان غير معروف' }

  const supabase = createClient()

  // Verify it's in trash (is_deleted = true) before hard deleting
  const { data: row } = await (supabase.from(meta.table) as any)
    .select('id')
    .eq('id', id)
    .eq(meta.companyField, companyId)
    .eq('is_deleted', true)
    .single()

  if (!row) return { ok: false, error: 'العنصر غير موجود في سلة المحذوفات' }

  const { error } = await (supabase.from(meta.table) as any)
    .delete()
    .eq('id', id)
    .eq(meta.companyField, companyId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── List trash ────────────────────────────────────────────────────────────────
export async function listTrash(
  companyId:  string,
  module?:    string,
  entityType?: string,
  limit = 100,
): Promise<TrashItem[]> {
  const supabase = createClient()
  const items: TrashItem[] = []

  const entitiesToQuery = Object.values(ENTITY_REGISTRY).filter(meta => {
    if (module && meta.module !== module) return false
    if (entityType && meta.type !== entityType) return false
    return true
  })

  await Promise.all(entitiesToQuery.map(async meta => {
    const { data } = await (supabase.from(meta.table) as any)
      .select(`id, ${meta.nameField}, deleted_at, deleted_by, ${meta.companyField}`)
      .eq(meta.companyField, companyId)
      .eq('is_deleted', true)
      .order('deleted_at', { ascending: false })
      .limit(limit)

    for (const row of data || []) {
      items.push({
        id:          row.id,
        type:        meta.type,
        module:      meta.module,
        labelAr:     meta.labelAr,
        labelArSing: meta.labelArSing,
        name:        row[meta.nameField] || '—',
        deleted_at:  row.deleted_at,
        deleted_by:  row.deleted_by,
        company_id:  row[meta.companyField],
      })
    }
  }))

  // Sort all items by deleted_at DESC
  return items.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime())
}

// ── Factory reset ─────────────────────────────────────────────────────────────
export async function factoryReset(
  companyId:    string,
  initiatedBy:  string,
  businessType: string,
  skipBackup    = false,
): Promise<ResetResult> {
  const supabase    = createClient()
  const counts: Record<string, number> = {}
  let backupId: string | undefined

  // 1. Auto-backup before reset
  if (!skipBackup) {
    try {
      const now      = new Date()
      const dateStr  = now.toISOString().slice(0, 10)
      const timeStr  = now.toTimeString().slice(0, 5).replace(':', '-')
      const label    = `قبل الإعادة - ${dateStr} ${timeStr}`
      const path     = buildStoragePath(companyId, `${dateStr}_${timeStr}_pre_reset`, 'json')

      const { data: snap } = await supabase
        .from('backup_snapshots')
        .insert({ company_id: companyId, label, type: 'auto', format: 'json', storage_path: path, status: 'pending' })
        .select('id').single()

      if (snap) {
        const payload   = await collectBackupData(companyId, businessType)
        const json      = JSON.stringify(payload, null, 2)
        const sizeBytes = new TextEncoder().encode(json).length
        const { error: upErr } = await uploadBackup(path, json, 'application/json')
        await supabase.from('backup_snapshots').update({
          status:       upErr ? 'failed' : 'ready',
          file_size:    sizeBytes,
          table_counts: payload.table_counts,
          error_message: upErr ?? null,
        }).eq('id', snap.id)
        if (!upErr) backupId = snap.id
      }
    } catch (e) {
      console.error('Pre-reset backup failed:', e)
      // Non-fatal — continue with reset
    }
  }

  // 2. Hard-delete child tables first (no soft-delete support)
  const hardTables = [
    { table: 'rental_returns',      fk: 'company_id' },
    { table: 'sale_items',          fk: 'company_id' },
    { table: 'sale_payments',       fk: 'company_id' },
    { table: 'purchase_items',      fk: 'company_id' },
    { table: 'purchase_payments',   fk: 'company_id' },
    { table: 'inventory_movements', fk: 'company_id' },
    { table: 'inventory',           fk: 'company_id' },
    { table: 'product_variants',    fk: null },  // via product_id cascade
  ]

  for (const { table, fk } of hardTables) {
    if (!fk) continue
    const { count } = await (supabase.from(table) as any)
      .delete()
      .eq(fk, companyId)
    counts[table] = count ?? 0
  }

  // 3. Delete soft-deletable entities in reset order
  for (const type of RESET_ORDER) {
    const meta = ENTITY_REGISTRY[type]
    const { count } = await (supabase.from(meta.table) as any)
      .delete()
      .eq(meta.companyField, companyId)
    counts[meta.table] = count ?? 0
  }

  // 4. Log the reset
  await supabase.from('factory_reset_log').insert({
    company_id:     companyId,
    initiated_by:   initiatedBy,
    backup_id:      backupId ?? null,
    tables_cleared: counts,
    status:         'completed',
  })

  // 5. Audit log
  await supabase.from('audit_logs').insert({
    company_id:  companyId,
    staff_name:  initiatedBy,
    action:      'factory_reset',
    entity_type: 'company',
    severity:    'critical',
    metadata:    JSON.stringify({ counts, backup_id: backupId }),
  })

  return { ok: true, counts, backupId }
}
