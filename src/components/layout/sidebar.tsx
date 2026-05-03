'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ShoppingBag,
  Users,
  Truck,
  BarChart3,
  Settings,
  ChevronLeft,
  BookOpen,
  Wallet,
  Receipt,
  DollarSign,
  Tag,
  Warehouse,
  TrendingUp,
  FileText,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import type { Company } from '@/types/database'

interface SidebarProps {
  company: Company
  user: any
}

const navGroups = [
  {
    label: 'الرئيسية',
    items: [
      { label: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard },
      { label: 'نقطة البيع (POS)', href: '/dashboard/pos', icon: ShoppingCart },
    ],
  },
  {
    label: 'المبيعات',
    items: [
      { label: 'فواتير المبيعات', href: '/dashboard/sales', icon: Receipt },
      { label: 'العملاء', href: '/dashboard/customers', icon: Users },
    ],
  },
  {
    label: 'المشتريات',
    items: [
      { label: 'فواتير الشراء', href: '/dashboard/purchases', icon: ShoppingBag },
      { label: 'الموردون', href: '/dashboard/suppliers', icon: Truck },
    ],
  },
  {
    label: 'المستودع',
    items: [
      { label: 'المنتجات', href: '/dashboard/inventory', icon: Package },
      { label: 'حركة المخزون', href: '/dashboard/inventory/movements', icon: Warehouse },
    ],
  },
  {
    label: 'المالية',
    items: [
      { label: 'المصروفات', href: '/dashboard/expenses', icon: DollarSign },
      { label: 'قيود المحاسبة', href: '/dashboard/journal', icon: BookOpen },
      { label: 'الصندوق', href: '/dashboard/wallet', icon: Wallet },
    ],
  },
  {
    label: 'التقارير',
    items: [
      { label: 'التقارير', href: '/dashboard/reports', icon: BarChart3 },
      { label: 'الأرباح والخسائر', href: '/dashboard/reports/profit-loss', icon: TrendingUp },
    ],
  },
  {
    label: 'الإعدادات',
    items: [
      { label: 'الفئات', href: '/dashboard/categories', icon: Tag },
      { label: 'الإعدادات', href: '/dashboard/settings', icon: Settings },
    ],
  },
]

export function Sidebar({ company, user }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-60 bg-card border-l flex flex-col h-screen shrink-0 shadow-sm">
      {/* Company Header */}
      <div className="p-4 border-b bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
            {getInitials(company?.name || 'ش')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{company?.name || 'شركتي'}</p>
            <p className="text-xs text-muted-foreground">{company?.currency || 'SAR'} · نظام ERP</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-4 py-1.5">
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-4 py-2 mx-2 rounded-lg text-sm transition-all',
                    active
                      ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-2 px-2">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
            م
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">المستخدم</p>
            <p className="text-[10px] text-muted-foreground">مدير النظام</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
