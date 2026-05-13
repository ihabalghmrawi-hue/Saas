'use client'

import { useState, useCallback } from 'react'

interface IntegrityCheckItem {
  check_type: string
  status: 'passed' | 'failed' | 'warning'
  details: Record<string, unknown>
  timestamp: string
}

interface UseIntegrityChecksReturn {
  results: IntegrityCheckItem[]
  history: any[]
  loading: boolean
  error: string | null
  runChecks: () => Promise<void>
  loadHistory: () => Promise<void>
}

export function useIntegrityChecks(): UseIntegrityChecksReturn {
  const [results, setResults] = useState<IntegrityCheckItem[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runChecks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/accounting/integrity')
      const data = await res.json()
      if (data.results) setResults(data.results)
      if (data.error) setError(data.error)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/integrity?history=true')
      const data = await res.json()
      if (data.history) setHistory(data.history)
    } catch { }
  }, [])

  return { results, history, loading, error, runChecks, loadHistory }
}
