'use client'

import { useState, useEffect, useCallback } from 'react'
import { auditRepo } from './audit-repository'
import { activityStream } from './activity-stream'
import { entityTimeline } from './entity-timeline'
import type { AuditTrailEntry } from '@/lib/workbench/types'
import type { TimelineEntry } from '@/lib/timeline/types'

export function useEntityAudit(entityType: string, entityId: string) {
  const [entries, setEntries] = useState<AuditTrailEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await auditRepo.getByEntity(entityType, entityId)
    setEntries(result)
    setLoading(false)
  }, [entityType, entityId])

  useEffect(() => { refresh() }, [refresh])

  return { entries, loading, refresh }
}

export function useActivityStream(entityType?: string, entityId?: string) {
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await activityStream.getActivityStream(entityType, entityId)
    setEntries(result)
    setLoading(false)
  }, [entityType, entityId])

  useEffect(() => { refresh() }, [refresh])

  return { entries, loading, refresh }
}

export function useEntityHistory(entityType: string, entityId: string) {
  const [changes, setChanges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await entityTimeline.getEntityHistory(entityType, entityId)
    setChanges(result)
    setLoading(false)
  }, [entityType, entityId])

  useEffect(() => { refresh() }, [refresh])

  return { changes, loading, refresh }
}

export function useAuditedAction() {
  const execute = useCallback(async <T>(
    action: () => Promise<T>,
    auditEntry: { action: string; actor: string; entityType: string; entityId: string; details: string; type?: AuditTrailEntry['type'] }
  ): Promise<{ result: T | null; error?: string }> => {
    try {
      const result = await action()
      await (auditRepo.log as (entry: Record<string, unknown>) => Promise<AuditTrailEntry | null>)({
        action: auditEntry.action,
        actor: auditEntry.actor,
        entityType: auditEntry.entityType,
        entityId: auditEntry.entityId,
        details: auditEntry.details,
        type: auditEntry.type ?? 'update',
        timestamp: Date.now(),
      })
      return { result }
    } catch (e) {
      return { result: null, error: (e as Error).message }
    }
  }, [])

  return { execute }
}
