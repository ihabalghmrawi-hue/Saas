'use client'

import { useState, useEffect, useCallback } from 'react'

export function useSalesOrders(filters?: Record<string, any>) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      const res = await globalThis.fetch(`/api/sales/orders?${params}`)
      const data = await res.json()
      if (data.data) setOrders(data.data)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [filters])

  useEffect(() => { loadData() }, [loadData])
  return { orders, loading, error, refresh: loadData }
}

export function useInvoices(filters?: Record<string, any>) {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.customer_id) params.set('customer_id', filters.customer_id)
      const res = await globalThis.fetch(`/api/sales/invoices?${params}`)
      const data = await res.json()
      if (data.data) setInvoices(data.data)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [filters])

  useEffect(() => { loadData() }, [loadData])
  return { invoices, loading, error, refresh: loadData }
}

export function usePayments(filters?: Record<string, any>) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      let url = '/api/sales/payments'
      if (filters) {
        const params = new URLSearchParams()
        if (filters.status) params.set('status', filters.status)
        if (filters.customer_id) params.set('customer_id', filters.customer_id)
        const qs = params.toString()
        if (qs) url += `?${qs}`
      }
      const res = await globalThis.fetch(url)
      const data = await res.json()
      if (data.data) setPayments(data.data)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [filters])

  useEffect(() => { loadData() }, [loadData])
  return { payments, loading, error, refresh: loadData }
}
