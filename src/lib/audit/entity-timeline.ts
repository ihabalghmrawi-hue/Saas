import { createClient } from '@/lib/supabase/client'

interface EntityChange {
  id: string
  entityType: string
  entityId: string
  field: string
  oldValue: unknown
  newValue: unknown
  changedBy: string
  changedAt: number
  changeType: 'create' | 'update' | 'delete'
}

export class EntityTimelineService {
  private supabase = createClient()

  async trackChange(change: Omit<EntityChange, 'id'>): Promise<void> {
    try {
      await this.supabase.from('entity_history').insert(change)
    } catch {}
  }

  async getEntityHistory(entityType: string, entityId: string): Promise<EntityChange[]> {
    try {
      const { data } = await this.supabase
        .from('entity_history')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('changed_at', { ascending: false })
      return (data ?? []) as EntityChange[]
    } catch { return [] }
  }

  async getFieldHistory(entityType: string, entityId: string, field: string): Promise<EntityChange[]> {
    try {
      const { data } = await this.supabase
        .from('entity_history')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('field', field)
        .order('changed_at', { ascending: false })
      return (data ?? []) as EntityChange[]
    } catch { return [] }
  }

  async getChangesByUser(userId: string, limit = 50): Promise<EntityChange[]> {
    try {
      const { data } = await this.supabase
        .from('entity_history')
        .select('*')
        .eq('changed_by', userId)
        .order('changed_at', { ascending: false })
        .limit(limit)
      return (data ?? []) as EntityChange[]
    } catch { return [] }
  }

  subscribe(entityType?: string, entityId?: string): { unsubscribe: () => void } {
    const channel = this.supabase
      .channel(`entity-timeline-${entityType ?? 'all'}-${entityId ?? 'all'}-${Date.now()}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'entity_history', ...(entityType ? { filter: `entity_type=eq.${entityType}` } : {}) },
        () => {}
      )
      .subscribe()
    return { unsubscribe: () => { this.supabase.removeChannel(channel) } }
  }
}

export const entityTimeline = new EntityTimelineService()

export async function trackEntityCreate(entityType: string, entityId: string, changedBy: string): Promise<void> {
  await entityTimeline.trackChange({
    entityType, entityId, field: '_created', oldValue: null, newValue: null,
    changedBy, changedAt: Date.now(), changeType: 'create',
  })
}

export async function trackEntityUpdate(entityType: string, entityId: string, field: string, oldValue: unknown, newValue: unknown, changedBy: string): Promise<void> {
  if (oldValue === newValue) return
  await entityTimeline.trackChange({
    entityType, entityId, field, oldValue, newValue,
    changedBy, changedAt: Date.now(), changeType: 'update',
  })
}

export async function trackEntityDelete(entityType: string, entityId: string, changedBy: string): Promise<void> {
  await entityTimeline.trackChange({
    entityType, entityId, field: '_deleted', oldValue: null, newValue: null,
    changedBy, changedAt: Date.now(), changeType: 'delete',
  })
}
