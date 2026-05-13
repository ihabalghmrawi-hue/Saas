'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PostingRuleEntity, CreatePostingRuleInput, UpdatePostingRuleInput } from '../entities/posting-rule.entity'

interface UsePostingRulesReturn {
  rules: PostingRuleEntity[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createRule: (input: CreatePostingRuleInput) => Promise<{ ok: boolean; error?: string }>
  updateRule: (id: string, input: UpdatePostingRuleInput) => Promise<{ ok: boolean; error?: string }>
  deleteRule: (id: string) => Promise<{ ok: boolean; error?: string }>
  toggleActive: (id: string) => Promise<{ ok: boolean; error?: string }>
}

export function usePostingRules(): UsePostingRulesReturn {
  const [rules, setRules] = useState<PostingRuleEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/accounting/posting-rules')
      const data = await res.json()
      if (data.rules) setRules(data.rules)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const createRule = useCallback(async (input: CreatePostingRuleInput) => {
    try {
      const res = await fetch('/api/accounting/posting-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (res.ok) { await fetchRules(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل إنشاء القاعدة' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchRules])

  const updateRule = useCallback(async (id: string, input: UpdatePostingRuleInput) => {
    try {
      const res = await fetch(`/api/accounting/posting-rules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...input }),
      })
      const data = await res.json()
      if (res.ok) { await fetchRules(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل تحديث القاعدة' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchRules])

  const deleteRule = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/accounting/posting-rules`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) { await fetchRules(); return { ok: true } }
      const data = await res.json()
      return { ok: false, error: data.error || 'فشل حذف القاعدة' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchRules])

  const toggleActive = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/accounting/posting-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !rules.find(r => r.id === id)?.is_active }),
      })
      const data = await res.json()
      if (res.ok) { await fetchRules(); return { ok: true } }
      return { ok: false, error: data.error || 'فشل تغيير حالة القاعدة' }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [fetchRules, rules])

  return { rules, loading, error, refresh: fetchRules, createRule, updateRule, deleteRule, toggleActive }
}
