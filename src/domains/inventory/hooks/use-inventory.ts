'use client'

import { useState, useEffect, useCallback } from 'react'

interface UseInventoryItemsReturn {
  items: any[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useInventoryItems(): UseInventoryItemsReturn {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/inventory/items')
      const data = await res.json()
      if (data.items) setItems(data.items)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])
  return { items, loading, error, refresh: fetchItems }
}

interface UseWarehousesReturn {
  warehouses: any[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useWarehouses(): UseWarehousesReturn {
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWarehouses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/inventory/warehouses')
      const data = await res.json()
      if (data.warehouses) setWarehouses(data.warehouses)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWarehouses() }, [fetchWarehouses])
  return { warehouses, loading, error, refresh: fetchWarehouses }
}

interface UseStockMovementReturn {
  movements: any[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useStockMovements(filters?: Record<string, any>): UseStockMovementReturn {
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMovements = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters?.item_id) params.set('item_id', filters.item_id)
      if (filters?.warehouse_id) params.set('warehouse_id', filters.warehouse_id)
      if (filters?.from_date) params.set('from_date', filters.from_date)
      if (filters?.to_date) params.set('to_date', filters.to_date)
      if (filters?.limit) params.set('limit', String(filters.limit))

      const res = await fetch(`/api/inventory/movements?${params}`)
      const data = await res.json()
      if (data.movements) setMovements(data.movements)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchMovements() }, [fetchMovements])
  return { movements, loading, error, refresh: fetchMovements }
}
