'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FiscalYearEntity, AccountingPeriodEntity } from '../entities/period.entity'

interface UseFiscalPeriodsReturn {
  years: FiscalYearEntity[]
  periods: AccountingPeriodEntity[]
  currentPeriod: AccountingPeriodEntity | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createYear: (input: { name: string; start_date: string; end_date: string }) => Promise<{ ok: boolean; error?: string }>
  generatePeriods: (yearId: string) => Promise<{ ok: boolean; error?: string }>
  closePeriod: (periodId: string) => Promise<{ ok: boolean; error?: string; warnings?: string[] }>
  openPeriod: (periodId: string) => Promise<{ ok: boolean; error?: string }>
  selectYear: (yearId: string) => Promise<void>
}

export function useFiscalPeriods(): UseFiscalPeriodsReturn {
  const [years, setYears] = useState<FiscalYearEntity[]>([])
  const [periods, setPeriods] = useState<AccountingPeriodEntity[]>([])
  const [currentPeriod, setCurrentPeriod] = useState<AccountingPeriodEntity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/accounting/periods')
      const data = await res.json()
      if (data.years) setYears(data.years)
      if (data.periods) {
        setPeriods(data.periods)
        const open = data.periods.find((p: AccountingPeriodEntity) => p.status === 'open')
        if (open) setCurrentPeriod(open)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const selectYear = useCallback(async (yearId: string) => {
    setSelectedYearId(yearId)
    try {
      const res = await fetch(`/api/accounting/periods?year_id=${yearId}`)
      const data = await res.json()
      if (data.periods) {
        setPeriods(data.periods)
        const open = data.periods.find((p: AccountingPeriodEntity) => p.status === 'open')
        if (open) setCurrentPeriod(open)
      }
    } catch { }
  }, [])

  const createYear = useCallback(async (input: { name: string; start_date: string; end_date: string }) => {
    try {
      const res = await fetch('/api/accounting/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ensure_fiscal_year', ...input }),
      })
      const data = await res.json()
      if (res.ok) { await fetchData(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل إنشاء السنة المالية' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchData])

  const generatePeriods = useCallback(async (yearId: string) => {
    try {
      const res = await fetch('/api/accounting/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_periods', fiscal_year_id: yearId }),
      })
      const data = await res.json()
      if (res.ok) { await fetchData(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل إنشاء الفترات' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchData])

  const closePeriod = useCallback(async (periodId: string) => {
    try {
      const res = await fetch('/api/accounting/periods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', period_id: periodId }),
      })
      const data = await res.json()
      if (res.ok) { await fetchData(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل إغلاق الفترة', warnings: data.warnings }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchData])

  const openPeriod = useCallback(async (periodId: string) => {
    try {
      const res = await fetch('/api/accounting/periods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', period_id: periodId }),
      })
      const data = await res.json()
      if (res.ok) { await fetchData(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل فتح الفترة' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchData])

  return {
    years, periods, currentPeriod, loading, error,
    refresh: fetchData, createYear, generatePeriods,
    closePeriod, openPeriod, selectYear,
  }
}
