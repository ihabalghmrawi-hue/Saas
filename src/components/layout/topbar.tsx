'use client'

import { Bell, Moon, Sun, Search, Settings } from 'lucide-react'
import { useTheme } from 'next-themes'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import type { Features } from '@/lib/features'

const pageTitles: Record<string, string> = {
  '/dashboard': 'الملخص المالي',
  '/dashboard/pos': 'نقطة البيع',
  '/dashboard/sales': 'فواتير المبيعات',
  '/dashboard/returns': 'المرتجعات',
  '/dashboard/customers': 'العملاء',
  '/dashboard/shifts': 'الورديات',
  '/dashboard/purchases': 'فواتير الشراء',
  '/dashboard/suppliers': 'الموردون',
  '/dashboard/inventory': 'المنتجات',
  '/dashboard/inventory/movements': 'حركة المخزون',
  '/dashboard/inventory/variants': 'المتغيرات',
  '/dashboard/expenses': 'المصروفات',
  '/dashboard/journal': 'قيود المحاسبة',
  '/dashboard/wallet': 'الصندوق',
  '/dashboard/reports': 'التقارير',
  '/dashboard/reports/profit-loss': 'الأرباح والخسائر',
  '/dashboard/admin/staff': 'إدارة الموظفين',
  '/dashboard/admin/audit': 'سجل الأحداث',
  '/dashboard/categories': 'الفئات',
  '/dashboard/settings': 'الإعدادات',
}

interface TopBarProps {
  company: any
  user: any
  staff?: { name: string; role: string; permissions: string[] }
  features: Features
}

export function TopBar({ company, user, staff, features }: TopBarProps) {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const title = pageTitles[pathname] || 'لوحة التحكم'

  return (
    <header className="h-14 border-b bg-card flex items-center px-6 gap-4 shrink-0">
      <div className="flex-1">
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
      </div>

      <div className="hidden md:flex items-center gap-2 bg-background border rounded-lg px-3 py-1.5 w-48">
        <Search className="w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="بحث..."
          className="bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground w-full"
        />
      </div>

      <div className="flex items-center gap-1">
        <span className="text-lg" title={features.label}>{features.icon}</span>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          suppressHydrationWarning
        >
          {mounted && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button className="relative p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {staff?.role === 'admin' && (
          <button
            onClick={() => router.push('/dashboard/settings')}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  )
}
