'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ReconciliationEntity, AgedReport } from '../entities/reconciliation.entity'

interface UseReconciliationReturn {
  reconciliations: ReconciliationEntity[]
  agedReceivables: AgedReport | null
  agedPayables: AgedReport | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createReconciliation: (input: {
    account_id: string
    reference_type: string
    statement_date: string
    statement_amount: number
    notes?: string
  }) => Promise<{ ok: boolean; error?: string }>
  autoMatch: (id: string) => Promise<{ ok: boolean; error?: string }>
  loadAgedReport: (type: 'receivables' | 'payables', asOfDate?: string) => Promise<void>
}

export function useReconciliation(): UseReconciliationReturn {
  const [reconciliations, setReconciliations] = useState<ReconciliationEntity[]>([])
  const [agedReceivables, setAgedReceivables] = useState<AgedReport | null>(null)
  const [agedPayables, setAgedPayables] = useState<AgedReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReconciliations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/accounting/reconciliation')
      const data = await res.json()
      if (data.reconciliations) setReconciliations(data.reconciliations)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReconciliations() }, [fetchReconciliations])

  const createReconciliation = useCallback(async (input: {
    account_id: string
    reference_type: string
    statement_date: string
    statement_amount: number
    notes?: string
  }) => {
    try {
      const res = await fetch('/api/accounting/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (res.ok) { await fetchReconciliations(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل إنشاء التسوية' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchReconciliations])

  const autoMatch = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/accounting/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_match', reconciliation_id: id }),
      })
      const data = await res.json()
      if (res.ok) { await fetchReconciliations(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل المطابقة التلقائية' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchReconciliations])

  const loadAgedReport = useCallback(async (type: 'receivables' | 'payables', asOfDate?: string) => {
    try {
      const params = new URLSearchParams({ type })
      if (asOfDate) params.set('as_of_date', asOfDate)
      const res = await fetch(`/api/accounting/aged?${params}`)
      const data = await res.json()
      if (type === 'receivables' && data.report) setAgedReceivables(data.report)
      if (type === 'payables' && data.report) setAgedPayables(data.report)
    } catch { }
  }, [])

  return {
    reconciliations, agedReceivables, agedPayables, loading, error,
    refresh: fetchReconciliations, createReconciliation, autoMatch, loadAgedReport,
  }
}
