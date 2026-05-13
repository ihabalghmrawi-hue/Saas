'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Wallet, ShoppingCart, Package, Users, FileText,
  Settings, ChevronDown, ChevronLeft, Search, Bell, Plus,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

interface MenuItem {
  id: string
  label: string
  icon: LucideIcon
  href?: string
  badge?: number | string
  children?: MenuItem[]
  roles?: string[]
}

const MENU_STRUCTURE: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'لوحة التحكم',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  {
    id: 'financial',
    label: 'المالية',
    icon: Wallet,
    children: [
      { id: 'journal', label: 'اليومية', icon: FileText, href: '/dashboard/accounting/journal' },
      { id: 'ledger', label: 'دفتر الأستاذ', icon: FileText, href: '/dashboard/accounting/ledger' },
      { id: 'trial-balance', label: 'ميزان المراجعة', icon: FileText, href: '/dashboard/accounting/trial-balance' },
      { id: 'reconciliation', label: 'التسويات', icon: FileText, href: '/dashboard/accounting/reconciliation' },
      { id: 'anomalies', label: 'حالات الشذوذ', icon: FileText, href: '/dashboard/accounting/anomalies', badge: '3' },
    ],
  },
  {
    id: 'sales',
    label: 'المبيعات',
    icon: ShoppingCart,
    children: [
      { id: 'invoices', label: 'الفواتير', icon: FileText, href: '/dashboard/sales/invoices' },
      { id: 'orders', label: 'الطلبات', icon: FileText, href: '/dashboard/sales/orders' },
      { id: 'customers', label: 'العملاء', icon: Users, href: '/dashboard/customers' },
    ],
  },
  {
    id: 'inventory',
    label: 'المخزون',
    icon: Package,
    children: [
      { id: 'products', label: 'المنتجات', icon: FileText, href: '/dashboard/inventory/products' },
      { id: 'movements', label: 'الحركات', icon: FileText, href: '/dashboard/inventory/movements' },
      { id: 'warehouses', label: 'المستودعات', icon: FileText, href: '/dashboard/warehouses' },
    ],
  },
  {
    id: 'reports',
    label: 'التقارير',
    icon: FileText,
    href: '/dashboard/reports',
  },
  {
    id: 'settings',
    label: 'الإعدادات',
    icon: Settings,
    href: '/dashboard/settings',
  },
]

interface RoleMenuProps {
  className?: string
  currentPath?: string
  collapsed?: boolean
  onNavigate?: () => void
}

export function RoleMenu({ className, currentPath = '', collapsed = false, onNavigate }: RoleMenuProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 'financial': true })
  const [searchQuery, setSearchQuery] = useState('')

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const isActive = (href?: string) => {
    if (!href) return false
    return currentPath.startsWith(href)
  }

  const filterMenu = (items: MenuItem[]): MenuItem[] => {
    if (!searchQuery) return items
    return items.filter(item => {
      if (item.label.includes(searchQuery)) return true
      if (item.children) return item.children.some(c => c.label.includes(searchQuery))
      return false
    })
  }

  const filtered = filterMenu(MENU_STRUCTURE)

  if (collapsed) {
    return (
      <nav className={cn('flex flex-col items-center gap-1 py-2', className)}>
        {MENU_STRUCTURE.map(item => {
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              href={item.href || '#'}
              onClick={onNavigate}
              className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title={item.label}
            >
              <Icon className="h-5 w-5" />
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className={cn('flex flex-col gap-0.5', className)}>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث في القائمة..."
            className="w-full h-9 pr-8 bg-muted/50 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary/20"
          />
        </div>
      </div>

      {filtered.map(item => {
        const Icon = item.icon
        const hasChildren = item.children && item.children.length > 0
        const active = isActive(item.href)

        if (hasChildren) {
          const isExpanded = expanded[item.id]
          const childActive = item.children?.some(c => isActive(c.href))
          return (
            <div key={item.id}>
              <button
                onClick={() => toggleExpand(item.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors',
                  childActive ? 'bg-accent/50 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
                <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
              </button>
              {isExpanded && (
                <div className="mr-4 border-r pr-2 space-y-0.5 mt-0.5">
                  {item.children!.map(child => {
                    const ChildIcon = child.icon
                    const childActive = isActive(child.href)
                    return (
                      <Link
                        key={child.id}
                        href={child.href || '#'}
                        onClick={onNavigate}
                        className={cn(
                          'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                          childActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <ChildIcon className="h-4 w-4" />
                          <span>{child.label}</span>
                        </div>
                        {child.badge && (
                          <span className="px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                            {child.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        }

        return (
          <Link
            key={item.id}
            href={item.href || '#'}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              active
                ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.badge && (
              <span className="mr-auto px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                {item.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
