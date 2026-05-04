'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, ShoppingBag, Users, Truck,
  BarChart3, Settings, BookOpen, Wallet, Receipt, DollarSign, Tag,
  Warehouse, TrendingUp, RotateCcw, Clock, Shield, UserCog, LogOut,
  Layers, Shirt, Calendar, CalendarDays, Trash2 as Trash2Icon, AlertOctagon,
  CreditCard,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import type { Features } from '@/lib/features'
import type { Branding } from '@/lib/branding'
import type { Company } from '@/types/database'

interface StaffInfo {
  name: string
  role: string
  permissions: string[]
}

interface SidebarProps {
  company: Company
  user: any
  staff?: StaffInfo
  features: Features
  branding?: Branding
}

function can(staff: StaffInfo | undefined, perm: string): boolean {
  if (!staff) return true
  if (staff.role === 'admin') return true
  return staff.permissions.includes(perm)
}

export function Sidebar({ company, user, staff, features, branding }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/staff-login')
  }

  const navGroups = [
    {
      label: 'الرئيسية',
      items: [
        { label: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard, show: true },
      ],
    },
    {
      label: 'المبيعات',
      items: [
        { label: 'نقطة البيع', href: '/dashboard/pos', icon: ShoppingCart, show: features.showPOS && can(staff, 'pos.access') },
        { label: 'فواتير المبيعات', href: '/dashboard/sales', icon: Receipt, show: features.showPOS && can(staff, 'returns.view') },
        { label: 'المرتجعات', href: '/dashboard/returns', icon: RotateCcw, show: features.showReturns && can(staff, 'returns.view') },
        { label: 'العملاء', href: '/dashboard/customers', icon: Users, show: features.showPOS && can(staff, 'customers.view') },
        { label: 'الورديات', href: '/dashboard/shifts', icon: Clock, show: features.showShifts && can(staff, 'shifts.manage') },
      ],
    },
    {
      label: 'المشتريات',
      items: [
        { label: 'فواتير الشراء', href: '/dashboard/purchases', icon: ShoppingBag, show: features.showPurchases && can(staff, 'purchases.view') },
        { label: 'الموردون', href: '/dashboard/suppliers', icon: Truck, show: features.showPurchases && can(staff, 'purchases.view') },
      ],
    },
    {
      label: 'المستودع',
      items: [
        { label: 'المنتجات', href: '/dashboard/inventory', icon: Package, show: features.showInventory && can(staff, 'inventory.view') },
        { label: 'حركة المخزون', href: '/dashboard/inventory/movements', icon: Warehouse, show: features.showInventory && can(staff, 'inventory.view') },
        { label: 'المتغيرات', href: '/dashboard/inventory/variants', icon: Layers, show: features.hasVariants && features.showInventory && can(staff, 'inventory.view') },
      ],
    },
    {
      label: 'المالية',
      items: [
        { label: 'المصروفات', href: '/dashboard/expenses', icon: DollarSign, show: can(staff, 'expenses.view') },
        { label: 'قيود المحاسبة', href: '/dashboard/journal', icon: BookOpen, show: can(staff, 'reports.view') },
        { label: 'الصندوق', href: '/dashboard/wallet', icon: Wallet, show: can(staff, 'reports.view') },
      ],
    },
    {
      label: 'التقارير',
      items: [
        { label: 'التقارير', href: '/dashboard/reports', icon: BarChart3, show: can(staff, 'reports.view') },
        { label: 'الأرباح والخسائر', href: '/dashboard/reports/profit-loss', icon: TrendingUp, show: can(staff, 'reports.view') },
      ],
    },
    {
      label: 'التأجير',
      items: [
        { label: 'لوحة التأجير', href: '/dashboard/rentals', icon: LayoutDashboard, show: features.hasRental },
        { label: 'الفساتين', href: '/dashboard/rentals/dresses', icon: Shirt, show: features.hasRental },
        { label: 'حجز سريع', href: '/dashboard/rentals/bookings/new', icon: Calendar, show: features.hasRental },
        { label: 'الحجوزات', href: '/dashboard/rentals/bookings', icon: CalendarDays, show: features.hasRental },
        { label: 'تقويم التأجير', href: '/dashboard/rentals/calendar', icon: CalendarDays, show: features.hasRental },
        { label: 'الإرجاعات', href: '/dashboard/rentals/returns', icon: RotateCcw, show: features.hasRental },
        { label: 'قواعد التسعير', href: '/dashboard/rentals/pricing', icon: Tag, show: features.hasRental },
      ],
    },
    {
      label: 'الإدارة',
      items: [
        { label: 'الموظفون',         href: '/dashboard/admin/staff',        icon: UserCog,     show: can(staff, 'admin.staff') },
        { label: 'سجل الأحداث',    href: '/dashboard/admin/audit',        icon: Shield,      show: can(staff, 'admin.audit') },
        { label: 'الفئات',          href: '/dashboard/categories',         icon: Tag,         show: can(staff, 'admin.settings') },
        { label: 'الإعدادات',       href: '/dashboard/settings',           icon: Settings,    show: can(staff, 'admin.settings') },
        { label: 'النسخ الاحتياطية', href: '/dashboard/settings/backup',   icon: Shield,      show: can(staff, 'admin.settings') },
        { label: 'سلة المحذوفات',   href: '/dashboard/settings/trash',    icon: Trash2Icon,  show: can(staff, 'admin.settings') },
        { label: 'منطقة الخطر',     href: '/dashboard/settings/danger',   icon: AlertOctagon,show: can(staff, 'admin.settings') },
        { label: 'الاشتراك والفوترة', href: '/dashboard/billing',           icon: CreditCard,  show: staff?.role === 'admin' || !staff },
      ],
    },
  ]

  const ROLE_LABELS: Record<string, string> = {
    admin: 'مدير النظام',
    manager: 'مدير',
    cashier: 'كاشير',
  }

  return (
    <aside className="w-60 bg-card border-l flex flex-col h-screen shrink-0 shadow-sm">
      {/* Company Header */}
      <div className="p-4 border-b bg-primary/5">
        <div className="flex items-center gap-3">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt="logo" className="w-9 h-9 rounded-xl object-contain bg-white p-0.5 shadow-sm shrink-0" />
          ) : (
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
              {getInitials(branding?.name_ar || company?.name || 'ش')}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{branding?.name_ar || company?.name || 'شركتي'}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span>{features.icon}</span>
              <span>{features.label}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(i => i.show)
          if (visibleItems.length === 0) return null
          return (
            <div key={group.label} className="mb-1">
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-4 py-1.5">
                {group.label}
              </p>
              {visibleItems.map((item) => {
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
          )
        })}
      </nav>

      {/* Staff Footer */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(staff?.name || 'م')[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{staff?.name || 'المدير'}</p>
            <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[staff?.role || 'admin'] || staff?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            title="تسجيل خروج"
            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
