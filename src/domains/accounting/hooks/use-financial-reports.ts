'use client'

import { useState, useCallback } from 'react'
import type { IncomeStatement, BalanceSheet, TrialBalance, CashFlowStatement } from '../reports/statement-generator'

interface UseFinancialReportsReturn {
  trialBalance: TrialBalance | null
  incomeStatement: IncomeStatement | null
  balanceSheet: BalanceSheet | null
  cashFlow: CashFlowStatement | null
  loading: boolean
  error: string | null
  generateTrialBalance: (fromDate?: string, toDate?: string) => Promise<void>
  generateIncomeStatement: (fromDate: string, toDate: string) => Promise<void>
  generateBalanceSheet: (asOfDate?: string) => Promise<void>
  generateCashFlow: (fromDate: string, toDate: string) => Promise<void>
  exportCsv: (type: string) => void
}

export function useFinancialReports(): UseFinancialReportsReturn {
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null)
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null)
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null)
  const [cashFlow, setCashFlow] = useState<CashFlowStatement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateTrialBalance = useCallback(async (fromDate?: string, toDate?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ report: 'trial_balance' })
      if (fromDate) params.set('from_date', fromDate)
      if (toDate) params.set('to_date', toDate)
      const res = await fetch(`/api/accounting/statements?${params}`)
      const data = await res.json()
      if (data.trialBalance) setTrialBalance(data.trialBalance)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const generateIncomeStatement = useCallback(async (fromDate: string, toDate: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ report: 'income', from_date: fromDate, to_date: toDate })
      const res = await fetch(`/api/accounting/statements?${params}`)
      const data = await res.json()
      if (data.incomeStatement) setIncomeStatement(data.incomeStatement)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const generateBalanceSheet = useCallback(async (asOfDate?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ report: 'balance' })
      if (asOfDate) params.set('as_of_date', asOfDate)
      const res = await fetch(`/api/accounting/statements?${params}`)
      const data = await res.json()
      if (data.balanceSheet) setBalanceSheet(data.balanceSheet)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const generateCashFlow = useCallback(async (fromDate: string, toDate: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ report: 'cash_flow', from_date: fromDate, to_date: toDate })
      const res = await fetch(`/api/accounting/statements?${params}`)
      const data = await res.json()
      if (data.cashFlow) setCashFlow(data.cashFlow)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const exportCsv = useCallback((type: string) => {
    const data = type === 'trial_balance' ? trialBalance
      : type === 'income' ? incomeStatement
      : type === 'balance' ? balanceSheet
      : cashFlow
    if (!data) return

    const rows = [Object.keys(data as any)]
    rows.push(Object.values(data as any).map(v => String(v)))
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}-report.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [trialBalance, incomeStatement, balanceSheet, cashFlow])

  return {
    trialBalance, incomeStatement, balanceSheet, cashFlow,
    loading, error,
    generateTrialBalance, generateIncomeStatement, generateBalanceSheet,
    generateCashFlow, exportCsv,
  }
}
