import { createClient } from '@/lib/supabase/client'
import type { TimelineEntry } from '@/lib/timeline/types'

export class ActivityStreamService {
  private supabase = createClient()

  async getActivityStream(entityType?: string, entityId?: string, limit = 50): Promise<TimelineEntry[]> {
    try {
      let query = this.supabase.from('activity_stream').select('*').order('timestamp', { ascending: false }).limit(limit)
      if (entityType) query = query.eq('entity_type', entityType)
      if (entityId) query = query.eq('entity_id', entityId)
      const { data } = await query
      return (data ?? []) as TimelineEntry[]
    } catch { return [] }
  }

  async getByCategory(category: string, limit = 50): Promise<TimelineEntry[]> {
    try {
      const { data } = await this.supabase
        .from('activity_stream')
        .select('*')
        .eq('category', category)
        .order('timestamp', { ascending: false })
        .limit(limit)
      return (data ?? []) as TimelineEntry[]
    } catch { return [] }
  }

  async recordActivity(entry: Omit<TimelineEntry, 'id'>): Promise<void> {
    try {
      await this.supabase.from('activity_stream').insert(entry)
    } catch {}
  }

  subscribeToStream(category?: string): { unsubscribe: () => void } {
    const filter = category ? `category=eq.${category}` : undefined
    const channel = this.supabase
      .channel(`activity-stream-${category ?? 'all'}-${Date.now()}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_stream', ...(filter ? { filter } : {}) },
        () => {}
      )
      .subscribe()
    return { unsubscribe: () => { this.supabase.removeChannel(channel) } }
  }
}

export const activityStream = new ActivityStreamService()
