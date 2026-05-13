'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Search, X, Loader2, FileText, Users, Wallet, Package, TrendingUp, Building2 } from 'lucide-react'
import { useGlobalWorkspaceActions } from '@/lib/workspace/provider'

const SEARCH_RESULTS = {
  financial: [
    { id: '1', title: 'قيد يومية # INV-2024-001', type: 'journal', path: '/dashboard/accounting/journal/1' },
    { id: '2', title: 'حساب العملاء', type: 'account', path: '/dashboard/accounting/chart-of-accounts' },
    { id: '3', title: 'فاتورة مبيعات # SLS-2024-042', type: 'invoice', path: '/dashboard/sales/invoices/42' },
  ],
  inventory: [
    { id: '4', title: 'منتج - لابتوب HP', type: 'product', path: '/dashboard/inventory/products/1' },
    { id: '5', title: 'مستودع الرياض', type: 'warehouse', path: '/dashboard/warehouses/1' },
  ],
  customers: [
    { id: '6', title: 'شركة الأفق للتجارة', type: 'customer', path: '/dashboard/customers/1' },
    { id: '7', title: 'مؤسسة النور', type: 'customer', path: '/dashboard/customers/2' },
  ],
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  journal: FileText,
  account: Wallet,
  invoice: FileText,
  product: Package,
  warehouse: Building2,
  customer: Users,
  report: TrendingUp,
}

const TYPE_LABELS: Record<string, string> = {
  journal: 'قيد يومية',
  account: 'حساب',
  invoice: 'فاتورة',
  product: 'منتج',
  warehouse: 'مستودع',
  customer: 'عميل',
  report: 'تقرير',
}

export function EnterpriseSearch() {
  const { state, closeSearch } = useGlobalWorkspaceActions()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const isOpen = state.enterpriseSearch.open

  useEffect(() => {
    if (!isOpen) { setQuery(''); return }
    setQuery('')
  }, [isOpen])

  useEffect(() => {
    if (!query.trim()) return
    setLoading(true)
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) closeSearch()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeSearch])

  const allResults = Object.entries(SEARCH_RESULTS).flatMap(([category, items]) =>
    items.filter(item => !query || item.title.includes(query)).map(item => ({ ...item, category }))
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[90] transition-opacity duration-200"
      onClick={closeSearch}
    >
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="fixed top-0 left-0 right-0 bg-card border-b shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="max-w-3xl mx-auto p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ابحث في النظام بأكمله..."
              className="w-full h-12 pr-10 pl-10 bg-muted/50 border rounded-xl text-base outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <kbd className="absolute left-10 top-1/2 -translate-y-1/2 hidden sm:inline-flex px-1.5 py-0.5 text-xs bg-muted rounded text-muted-foreground">
              ESC
            </kbd>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && query && allResults.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>لا توجد نتائج لـ "{query}"</p>
            </div>
          )}

          {!loading && allResults.length > 0 && (
            <div className="mt-4 space-y-1 max-h-[50vh] overflow-y-auto">
              {allResults.slice(0, 20).map(result => {
                const Icon = TYPE_ICONS[result.type] || FileText
                return (
                  <button
                    key={result.id}
                    onClick={() => { window.location.href = result.path; closeSearch() }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors text-right group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{result.title}</div>
                      <div className="text-xs text-muted-foreground">{TYPE_LABELS[result.type]}</div>
                    </div>
                    <kbd className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-xs bg-muted rounded">
                      ↵
                    </kbd>
                  </button>
                )
              })}
            </div>
          )}

          {!query && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(SEARCH_RESULTS).map(([category, items]) => {
                const Icon = TYPE_ICONS[items[0]?.type] || FileText
                return (
                  <button
                    key={category}
                    onClick={() => setQuery(items[0]?.title || '')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 hover:bg-accent transition-colors text-right text-sm"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{category === 'financial' ? 'المالية' : category === 'inventory' ? 'المخزون' : 'العملاء'}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
