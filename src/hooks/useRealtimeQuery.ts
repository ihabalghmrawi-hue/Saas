'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { BaseRepository, RepositoryEvent } from '@/lib/supabase/repositories/base-repository'

export interface UseRealtimeQueryOptions<T extends { id: string }> {
  repository: BaseRepository<T>
  filters?: Record<string, unknown>
  orderBy?: { column: string; ascending?: boolean }
  page?: number
  pageSize?: number
  enabled?: boolean
  subscribe?: boolean
  subscribeFilter?: { column: string; value: string }
  onEvent?: (event: RepositoryEvent<T>) => void
}

export interface UseRealtimeQueryResult<T> {
  data: T[]
  total: number
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  isStale: boolean
}

export function useRealtimeQuery<T extends { id: string }>({
  repository,
  filters,
  orderBy,
  page,
  pageSize,
  enabled = true,
  subscribe: shouldSubscribe = true,
  subscribeFilter,
  onEvent,
}: UseRealtimeQueryOptions<T>): UseRealtimeQueryResult<T> {
  const [data, setData] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)

  const mountedRef = useRef(true)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const pendingEventsRef = useRef<RepositoryEvent<T>[]>([])
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dedupMapRef = useRef<Map<string, RepositoryEvent<T>>>(new Map())
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const processPendingEvents = useCallback(() => {
    const events = pendingEventsRef.current.slice()
    pendingEventsRef.current = []
    dedupMapRef.current.clear()
    debounceTimerRef.current = null

    setData(prev => {
      let updated = [...prev]
      for (const evt of events) {
        if (evt.eventType === 'INSERT' && evt.new) {
          updated = [evt.new, ...updated]
        } else if (evt.eventType === 'UPDATE' && evt.new) {
          updated = updated.map(item =>
            item.id === evt.new!.id ? evt.new! : item
          )
        } else if (evt.eventType === 'DELETE' && evt.old) {
          updated = updated.filter(item => item.id !== evt.old!.id)
        }
      }
      return updated
    })

    setIsStale(true)
  }, [])

  const handleEvent = useCallback((event: RepositoryEvent<T>) => {
    onEventRef.current?.(event)

    if (event.eventType === 'INSERT' || event.eventType === 'UPDATE' || event.eventType === 'DELETE') {
      const eventId = event.eventType === 'DELETE'
        ? event.old?.id
        : event.new?.id

      if (eventId) {
        dedupMapRef.current.set(eventId, event)
      }

      pendingEventsRef.current = Array.from(dedupMapRef.current.values())

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(processPendingEvents, 100)
    }
  }, [processPendingEvents])

  const fetchData = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const result = await repository.getAll({
        filters,
        orderBy,
        page,
        pageSize,
      })
      if (!mountedRef.current) return
      if (result.error) {
        setError(result.error)
      } else {
        setData(result.data)
        setTotal(result.total)
        setIsStale(false)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [repository, filters, orderBy, page, pageSize, enabled])

  useEffect(() => {
    mountedRef.current = true
    if (enabled) {
      fetchData()
    }
    return () => {
      mountedRef.current = false
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [enabled, fetchData])

  useEffect(() => {
    if (!enabled || !shouldSubscribe) return

    const { unsubscribe } = repository.subscribe(handleEvent, subscribeFilter)
    unsubscribeRef.current = unsubscribe

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      unsubscribeRef.current = null
    }
  }, [enabled, shouldSubscribe, subscribeFilter, handleEvent, repository])

  const refetch = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  return { data, total, loading, error, refetch, isStale }
}
