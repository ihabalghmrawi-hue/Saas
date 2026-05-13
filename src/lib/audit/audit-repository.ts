import { createClient } from '@/lib/supabase/client'
import type { AuditTrailEntry } from '@/lib/workbench/types'

export class AuditRepository {
  private supabase = createClient()

  async log(entry: Omit<AuditTrailEntry, 'id'>): Promise<AuditTrailEntry | null> {
    try {
      const { data, error } = await this.supabase
        .from('audit_trail')
        .insert({ ...entry, timestamp: entry.timestamp ?? Date.now() })
        .select()
        .single()
      if (error) { console.error('Audit log error:', error); return null }
      return data as AuditTrailEntry
    } catch { return null }
  }

  async getByEntity(entityType: string, entityId: string, limit = 50): Promise<AuditTrailEntry[]> {
    try {
      const { data } = await this.supabase
        .from('audit_trail')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('timestamp', { ascending: false })
        .limit(limit)
      return (data ?? []) as AuditTrailEntry[]
    } catch { return [] }
  }

  async getByUser(userId: string, limit = 50): Promise<AuditTrailEntry[]> {
    try {
      const { data } = await this.supabase
        .from('audit_trail')
        .select('*')
        .eq('actor', userId)
        .order('timestamp', { ascending: false })
        .limit(limit)
      return (data ?? []) as AuditTrailEntry[]
    } catch { return [] }
  }

  async getByDateRange(start: number, end: number, limit = 100): Promise<AuditTrailEntry[]> {
    try {
      const { data } = await this.supabase
        .from('audit_trail')
        .select('*')
        .gte('timestamp', start)
        .lte('timestamp', end)
        .order('timestamp', { ascending: false })
        .limit(limit)
      return (data ?? []) as AuditTrailEntry[]
    } catch { return [] }
  }

  async getByType(type: AuditTrailEntry['type'], limit = 50): Promise<AuditTrailEntry[]> {
    try {
      const { data } = await this.supabase
        .from('audit_trail')
        .select('*')
        .eq('type', type)
        .order('timestamp', { ascending: false })
        .limit(limit)
      return (data ?? []) as AuditTrailEntry[]
    } catch { return [] }
  }

  async getRecent(limit = 20): Promise<AuditTrailEntry[]> {
    try {
      const { data } = await this.supabase
        .from('audit_trail')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)
      return (data ?? []) as AuditTrailEntry[]
    } catch { return [] }
  }

  async search(query: string, limit = 50): Promise<AuditTrailEntry[]> {
    try {
      const { data } = await this.supabase
        .from('audit_trail')
        .select('*')
        .or(`action.ilike.%${query}%,actor.ilike.%${query}%,details.ilike.%${query}%`)
        .order('timestamp', { ascending: false })
        .limit(limit)
      return (data ?? []) as AuditTrailEntry[]
    } catch { return [] }
  }

  subscribe(entityType?: string, entityId?: string): { unsubscribe: () => void } {
    const channel = this.supabase
      .channel(`audit-${entityType ?? 'all'}-${entityId ?? 'all'}-${Date.now()}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_trail', ...(entityType && entityId ? { filter: `entity_type=eq.${entityType}` } : {}) },
        () => {}
      )
      .subscribe()
    return { unsubscribe: () => { this.supabase.removeChannel(channel) } }
  }
}

export const auditRepo = new AuditRepository()

export async function logEntityAction(
  action: string,
  actor: string,
  entityType: string,
  entityId: string,
  entityName: string,
  details: string,
  type: AuditTrailEntry['type'] = 'update'
): Promise<void> {
  await auditRepo.log({
    action, actor, details, type,
    timestamp: Date.now(),
  } as AuditTrailEntry)
}

export async function logWorkflowAction(instanceId: string, actor: string, action: string, details: string): Promise<void> {
  await logEntityAction(action, actor, 'workflow', instanceId, `سير العمل ${instanceId}`, details, 'system')
}

export async function logApprovalAction(requestId: string, actor: string, decision: string, comments?: string): Promise<void> {
  await logEntityAction(
    `approval_${decision}`, actor, 'approval', requestId,
    `طلب اعتماد ${requestId}`, comments ?? `تم ${decision === 'approved' ? 'الاعتماد' : 'الرفض'}`, 'approve'
  )
}

export async function logPostingAction(entryId: string, actor: string, type: 'journal' | 'invoice' | 'payment'): Promise<void> {
  await logEntityAction('posted', actor, type, entryId, `${type === 'journal' ? 'قيود اليومية' : type === 'invoice' ? 'الفاتورة' : 'الدفعة'} ${entryId}`, 'تم الترحيل', 'post')
}
