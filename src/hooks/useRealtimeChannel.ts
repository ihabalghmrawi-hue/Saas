'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

export type ChannelStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface UseRealtimeChannelOptions {
  channelName: string
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  schema?: string
  table: string
  filter?: string
  onPayload: (payload: any) => void
  enabled?: boolean
}

export interface UseRealtimeChannelResult {
  status: ChannelStatus
  reconnect: () => void
  error: string | null
}

export function useRealtimeChannel({
  channelName,
  event,
  schema = 'public',
  table,
  filter,
  onPayload,
  enabled = true,
}: UseRealtimeChannelOptions): UseRealtimeChannelResult {
  const [status, setStatus] = useState<ChannelStatus>('connecting')
  const [error, setError] = useState<string | null>(null)

  const clientRef = useRef<ReturnType<typeof createClient> | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const mountedRef = useRef(true)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onPayloadRef = useRef(onPayload)
  onPayloadRef.current = onPayload

  const setupChannelRef = useRef<() => void>()

  const cleanupChannel = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (channelRef.current) {
      if (clientRef.current) {
        clientRef.current.removeChannel(channelRef.current)
      }
      channelRef.current = null
      clientRef.current = null
    }
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return
    if (reconnectAttemptRef.current >= 5) {
      setError('Max reconnection attempts reached')
      setStatus('error')
      return
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 16000)
    reconnectAttemptRef.current++

    setStatus('connecting')
    setError(null)

    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setupChannelRef.current?.()
      }
    }, delay)
  }, [])

  setupChannelRef.current = () => {
    if (!mountedRef.current || !enabled) return

    cleanupChannel()

    const client = createClient()
    clientRef.current = client

    const channel = client.channel(channelName)
    channelRef.current = channel

    const eventConfig: Record<string, unknown> = {
      schema,
      table,
    }
    if (event !== '*') {
      eventConfig.event = event
    }
    if (filter) {
      eventConfig.filter = filter
    }

    channel.on('postgres_changes' as any, eventConfig, (payload: unknown) => {
      if (mountedRef.current) {
        onPayloadRef.current(payload)
      }
    })

    channel.subscribe((subStatus: string) => {
      if (!mountedRef.current) return

      switch (subStatus) {
        case 'SUBSCRIBED':
          setStatus('connected')
          setError(null)
          reconnectAttemptRef.current = 0
          break
        case 'CHANNEL_ERROR':
          setStatus('error')
          setError('Channel error occurred')
          scheduleReconnect()
          break
        case 'TIMED_OUT':
          setStatus('error')
          setError('Subscription timed out')
          scheduleReconnect()
          break
        case 'CLOSED':
          setStatus('disconnected')
          scheduleReconnect()
          break
        default:
          if (subStatus === 'connecting' || subStatus === 'SUBSCRIBING') {
            setStatus('connecting')
          }
          break
      }
    })
  }

  useEffect(() => {
    mountedRef.current = true
    if (enabled) {
      setupChannelRef.current?.()
    }
    return () => {
      mountedRef.current = false
      cleanupChannel()
    }
  }, [enabled, cleanupChannel])

  const reconnect = useCallback(() => {
    if (!mountedRef.current) return
    reconnectAttemptRef.current = 0
    setStatus('connecting')
    setError(null)
    setupChannelRef.current?.()
  }, [])

  return { status, reconnect, error }
}
