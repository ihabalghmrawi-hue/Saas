'use client'

import { useState, useEffect, useCallback } from 'react'
import type { JournalEntryEntity, CreateJournalEntryInput } from '../entities/journal.entity'

interface JournalFilters {
  status?: string
  source?: string
  fromDate?: string
  toDate?: string
  periodId?: string
  search?: string
  page?: number
  limit?: number
}

interface UseJournalEntriesReturn {
  entries: JournalEntryEntity[]
  count: number
  loading: boolean
  error: string | null
  filters: JournalFilters
  setFilters: (filters: JournalFilters) => void
  refresh: () => Promise<void>
  createEntry: (input: CreateJournalEntryInput) => Promise<{ ok: boolean; data?: any; error?: string }>
  postEntry: (id: string) => Promise<{ ok: boolean; error?: string }>
  reverseEntry: (id: string, reason?: string) => Promise<{ ok: boolean; error?: string }>
  voidEntry: (id: string) => Promise<{ ok: boolean; error?: string }>
}

export function useJournalEntries(initialFilters?: JournalFilters): UseJournalEntriesReturn {
  const [entries, setEntries] = useState<JournalEntryEntity[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<JournalFilters>(initialFilters || {})

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.source) params.set('source', filters.source)
      if (filters.fromDate) params.set('from_date', filters.fromDate)
      if (filters.toDate) params.set('to_date', filters.toDate)
      if (filters.periodId) params.set('period_id', filters.periodId)
      if (filters.search) params.set('search', filters.search)
      if (filters.page) params.set('page', String(filters.page))
      if (filters.limit) params.set('limit', String(filters.limit))

      const res = await fetch(`/api/accounting/journal?${params}`)
      const data = await res.json()
      if (data.entries) setEntries(data.entries)
      if (data.count !== undefined) setCount(data.count)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const createEntry = useCallback(async (input: CreateJournalEntryInput) => {
    try {
      const res = await fetch('/api/accounting/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (res.ok) { await fetchEntries(); return { ok: true, data } }
      return { ok: false, error: data.error || 'فشل إنشاء القيد' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchEntries])

  const postEntry = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/accounting/journal/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post' }),
      })
      const data = await res.json()
      if (res.ok) { await fetchEntries(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل ترحيل القيد' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchEntries])

  const reverseEntry = useCallback(async (id: string, reason?: string) => {
    try {
      const res = await fetch(`/api/accounting/journal/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reverse', reason }),
      })
      const data = await res.json()
      if (res.ok) { await fetchEntries(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل عكس القيد' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchEntries])

  const voidEntry = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/accounting/journal/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void' }),
      })
      const data = await res.json()
      if (res.ok) { await fetchEntries(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل إلغاء القيد' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchEntries])

  return {
    entries, count, loading, error, filters, setFilters,
    refresh: fetchEntries, createEntry, postEntry, reverseEntry, voidEntry,
  }
}
