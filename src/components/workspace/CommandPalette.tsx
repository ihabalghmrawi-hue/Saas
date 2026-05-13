'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useGlobalWorkspaceActions } from '@/lib/workspace/provider'
import { Search, Command, ArrowRight, FileText, Users, Wallet, ShoppingCart, Building2, Layout } from 'lucide-react'

const SEARCH_CATEGORIES = [
  { id: 'financial', label: 'المالية', icon: Wallet },
  { id: 'inventory', label: 'المخزون', icon: Building2 },
  { id: 'sales', label: 'المبيعات', icon: ShoppingCart },
  { id: 'hr', label: 'الموارد البشرية', icon: Users },
  { id: 'reports', label: 'التقارير', icon: FileText },
  { id: 'workspaces', label: 'مساحات العمل', icon: Layout },
]

const QUICK_ACTIONS = [
  { id: 'new-journal', label: 'قيد يومية جديد', shortcut: 'Ctrl+J', category: 'financial' },
  { id: 'new-invoice', label: 'فاتورة جديدة', shortcut: 'Ctrl+I', category: 'sales' },
  { id: 'new-product', label: 'منتج جديد', shortcut: 'Ctrl+P', category: 'inventory' },
  { id: 'new-purchase', label: 'أمر شراء جديد', shortcut: 'Ctrl+Shift+P', category: 'procurement' },
  { id: 'reconcile', label: 'تسوية بنكية', shortcut: '', category: 'financial' },
  { id: 'trial-balance', label: 'ميزان المراجعة', shortcut: '', category: 'financial' },
  { id: 'stock-take', label: 'جرد مخزون', shortcut: '', category: 'inventory' },
  { id: 'payroll-run', label: 'تشغيل الرواتب', shortcut: '', category: 'hr' },
  { id: 'attendance', label: 'تسجيل الحضور', shortcut: '', category: 'hr' },
  { id: 'customer-report', label: 'تقرير العملاء', shortcut: '', category: 'sales' },
]

const RECENT_PAGES = [
  { id: '1', label: 'دفتر الأستاذ', path: '/dashboard/accounting/ledger' },
  { id: '2', label: 'فواتير المبيعات', path: '/dashboard/sales/invoices' },
  { id: '3', label: 'حركة المخزون', path: '/dashboard/inventory/movements' },
]

export function CommandPalette() {
  const { state, closeCommandPalette } = useGlobalWorkspaceActions()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const isOpen = state.commandPalette.open

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setActiveIndex(0)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) closeCommandPalette()
        else document.dispatchEvent(new CustomEvent('open-command-palette'))
      }
      if (e.key === 'Escape' && isOpen) closeCommandPalette()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeCommandPalette])

  const filtered = QUICK_ACTIONS.filter(a =>
    a.label.includes(query) || a.category.includes(query)
  )

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtered[activeIndex]) {
      closeCommandPalette()
    }
  }, [filtered, activeIndex, closeCommandPalette])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={closeCommandPalette}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-card border rounded-xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="ابحث عن صفحات، إجراءات، تقارير..."
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-muted rounded text-muted-foreground">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {!query && (
            <div className="mb-2">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">آخر الصفحات</div>
              {RECENT_PAGES.map(page => (
                <button
                  key={page.id}
                  onClick={() => { window.location.href = page.path; closeCommandPalette() }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors text-right"
                >
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span>{page.label}</span>
                </button>
              ))}
            </div>
          )}

          {SEARCH_CATEGORIES.filter(c =>
            !query || c.label.includes(query)
          ).map(cat => {
            const Icon = cat.icon
            const catActions = filtered.filter(a => a.category === cat.id)
            if (query && catActions.length === 0) return null
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{cat.label}</span>
                </div>
                {catActions.map((action, idx) => {
                  const globalIdx = filtered.indexOf(action)
                  return (
                    <button
                      key={action.id}
                      onClick={() => closeCommandPalette()}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors text-right',
                        globalIdx === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                      )}
                    >
                      <span>{action.label}</span>
                      {action.shortcut && (
                        <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded text-muted-foreground">
                          {action.shortcut}
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
