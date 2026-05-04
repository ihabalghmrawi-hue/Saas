'use client'

import { Bell, Moon, Sun, Search } from 'lucide-react'
import { useTheme } from 'next-themes'
import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/dashboard': 'الملخص المالي',
  '/dashboard/transactions': 'المعاملات المالية',
  '/dashboard/journal': 'قيود المحاسبة',
  '/dashboard/wallet': 'الصندوق',
  '/dashboard/reports': 'التقارير المالية',
  '/dashboard/parties': 'العملاء والموردون',
  '/dashboard/categories': 'الفئات',
  '/dashboard/settings': 'الإعدادات',
}

interface TopBarProps {
  company: any
  user: any
  staff?: { name: string; role: string; permissions: string[] }
}

export function TopBar({ company, user, staff }: TopBarProps) {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  
  const title = pageTitles[pathname] || 'القسم المالي'

  return (
    <header className="h-16 border-b bg-card flex items-center px-6 gap-4 shrink-0">
      {/* Page Title */}
      <div className="flex-1">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">{company.name}</p>
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 bg-background border rounded-lg px-3 py-2 w-56">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="بحث..."
          className="bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground w-full"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  )
}
