'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AccountEntity, AccountTree, CreateAccountInput, UpdateAccountInput } from '../entities/account.entity'

interface UseChartOfAccountsReturn {
  accounts: AccountEntity[]
  tree: AccountTree[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createAccount: (input: CreateAccountInput) => Promise<{ ok: boolean; error?: string }>
  updateAccount: (id: string, input: UpdateAccountInput) => Promise<{ ok: boolean; error?: string }>
  toggleActive: (id: string, isActive: boolean) => Promise<{ ok: boolean; error?: string }>
}

export function useChartOfAccounts(): UseChartOfAccountsReturn {
  const [accounts, setAccounts] = useState<AccountEntity[]>([])
  const [tree, setTree] = useState<AccountTree[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/accounting/coa')
      const data = await res.json()
      if (data.accounts) setAccounts(data.accounts)
      if (data.tree) setTree(data.tree)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const createAccount = useCallback(async (input: CreateAccountInput) => {
    try {
      const res = await fetch('/api/accounting/coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (res.ok) { await fetchAccounts(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل إنشاء الحساب' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchAccounts])

  const updateAccount = useCallback(async (id: string, input: UpdateAccountInput) => {
    try {
      const res = await fetch('/api/accounting/coa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...input }),
      })
      const data = await res.json()
      if (res.ok) { await fetchAccounts(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل تحديث الحساب' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchAccounts])

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/accounting/coa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: isActive }),
      })
      const data = await res.json()
      if (res.ok) { await fetchAccounts(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل تغيير حالة الحساب' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchAccounts])

  return { accounts, tree, loading, error, refresh: fetchAccounts, createAccount, updateAccount, toggleActive }
}
