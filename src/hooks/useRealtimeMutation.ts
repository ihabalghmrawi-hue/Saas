'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { BaseRepository } from '@/lib/supabase/repositories/base-repository'

export type MutationAction = 'create' | 'update' | 'delete'

export interface UseRealtimeMutationOptions<T extends { id: string }> {
  repository: BaseRepository<T>
  onSuccess?: (action: MutationAction, data: T | null) => void
  onError?: (action: MutationAction, error: string) => void
}

export interface UseRealtimeMutationResult<T> {
  create: (item: Partial<T>) => Promise<T | null>
  update: (id: string, changes: Partial<T>) => Promise<T | null>
  remove: (id: string) => Promise<boolean>
  executing: boolean
  lastAction: MutationAction | null
  lastError: string | null
  reset: () => void
}

export function useRealtimeMutation<T extends { id: string }>({
  repository,
  onSuccess,
  onError,
}: UseRealtimeMutationOptions<T>): UseRealtimeMutationResult<T> {
  const [executing, setExecuting] = useState(false)
  const [lastAction, setLastAction] = useState<MutationAction | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pendingMutations = useRef<Map<string, { changes: Partial<T>; resolve: (value: any) => void }>>(new Map())
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  onSuccessRef.current = onSuccess
  onErrorRef.current = onError

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      for (const timer of debounceTimers.current.values()) {
        clearTimeout(timer)
      }
      for (const [, pending] of pendingMutations.current) {
        pending.resolve(null)
      }
      debounceTimers.current.clear()
      pendingMutations.current.clear()
    }
  }, [])

  const executeWithRetry = useCallback(async <TResult>(
    fn: () => Promise<{ data: TResult | null; error?: string }>,
    action: MutationAction,
  ): Promise<TResult | null> => {
    let lastErr: string | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await fn()
        if (result.error) {
          lastErr = result.error
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
          }
        } else {
          return result.data
        }
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err)
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
        }
      }
    }
    const message = lastErr ?? 'Unknown error'
    if (mountedRef.current) {
      setLastError(message)
      onErrorRef.current?.(action, message)
    }
    return null
  }, [])

  const create = useCallback(async (item: Partial<T>): Promise<T | null> => {
    setExecuting(true)
    setLastAction('create')
    setLastError(null)

    const result = await executeWithRetry(() => repository.create(item), 'create')

    if (mountedRef.current) {
      setExecuting(false)
      if (result) {
        setLastAction(null)
        onSuccessRef.current?.('create', result)
      }
    }
    return result
  }, [repository, executeWithRetry])

  const update = useCallback((id: string, changes: Partial<T>): Promise<T | null> => {
    const key = `update:${id}`

    setExecuting(true)
    setLastAction('update')
    setLastError(null)

    return new Promise<T | null>((resolve) => {
      if (debounceTimers.current.has(key)) {
        clearTimeout(debounceTimers.current.get(key)!)
      }

      pendingMutations.current.set(key, { changes, resolve })

      const timer = setTimeout(async () => {
        debounceTimers.current.delete(key)
        const pending = pendingMutations.current.get(key)
        pendingMutations.current.delete(key)
        const latestChanges = pending?.changes ?? changes

        const result = await executeWithRetry(
          () => repository.update(id, latestChanges),
          'update',
        )

        if (mountedRef.current) {
          setExecuting(false)
          if (result) {
            setLastAction(null)
            onSuccessRef.current?.('update', result)
          }
          resolve(result)
        } else {
          resolve(null)
        }
      }, 300)

      debounceTimers.current.set(key, timer)
    })
  }, [repository, executeWithRetry])

  const remove = useCallback((id: string): Promise<boolean> => {
    const key = `delete:${id}`

    setExecuting(true)
    setLastAction('delete')
    setLastError(null)

    return new Promise<boolean>((resolve) => {
      if (debounceTimers.current.has(key)) {
        clearTimeout(debounceTimers.current.get(key)!)
      }

      pendingMutations.current.set(key, {
        changes: { id } as Partial<T>,
        resolve: (v: any) => resolve(!!v),
      })

      const timer = setTimeout(async () => {
        debounceTimers.current.delete(key)
        pendingMutations.current.delete(key)

        const result = await executeWithRetry(
          () => repository.delete(id).then(r => ({ data: r.error ? null : ({} as T), error: r.error })),
          'delete',
        )

        if (mountedRef.current) {
          setExecuting(false)
          if (result !== null) {
            setLastAction(null)
            onSuccessRef.current?.('delete', null)
            resolve(true)
          } else {
            resolve(false)
          }
        } else {
          resolve(false)
        }
      }, 300)

      debounceTimers.current.set(key, timer)
    })
  }, [repository, executeWithRetry])

  const reset = useCallback(() => {
    setExecuting(false)
    setLastAction(null)
    setLastError(null)
    for (const timer of debounceTimers.current.values()) {
      clearTimeout(timer)
    }
    debounceTimers.current.clear()
    pendingMutations.current.clear()
  }, [])

  return { create, update, remove, executing, lastAction, lastError, reset }
}
