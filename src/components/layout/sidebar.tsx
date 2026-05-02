'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  ArrowUpDown, 
  BookOpen, 
  Wallet, 
  BarChart3, 
  Settings,
  ChevronLeft,
  Building2,
  LogOut,
  Users,
  Tag
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn, getInitials } from '@/lib/utils'
import type { Company } from '@/types/database'

interface SidebarProps {
  company: Company
  user: any
}

const navItems = [
  {
    label: 'لوحة التحكم',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'المعاملات',
    href: '/dashboard/transactions',
    icon: ArrowUpDown,
  },
  {
    label: 'قيود المحاسبة',
    href: '/dashboard/journal',
    icon: BookOpen,
  },
  {
    label: 'الصندوق',
    href: '/dashboard/wallet',
    icon: Wallet,
  },
  {
    label: 'التقارير',
    href: '/dashboard/reports',
    icon: BarChart3,
  },
  {
    label: 'الأطراف',
    href: '/dashboard/parties',
    icon: Users,
  },
  {
    label: 'الفئات',
    href: '/dashboard/categories',
    icon: Tag,
  },
]

export function Sidebar({ company, user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="w-64 bg-card border-l flex flex-col h-screen shrink-0 shadow-sm">
      {/* Company Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
            {getInitials(company.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{company.name}</p>
            <p className="text-xs text-muted-foreground">{company.currency}</p>
          </div>
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider px-3 mb-2 mt-1">
          القائمة الرئيسية
        </p>

        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'sidebar-link',
                isActive && 'active'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}

        <div className="pt-4 mt-4 border-t">
          <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider px-3 mb-2">
            الإعدادات
          </p>
          <Link
            href="/dashboard/settings"
            className={cn(
              'sidebar-link',
              pathname.startsWith('/dashboard/settings') && 'active'
            )}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>الإعدادات</span>
          </Link>
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer group">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {getInitials(user.email?.split('@')[0] || 'U')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user.user_metadata?.full_name || user.email?.split('@')[0]}
            </p>
            <p className="text-xs text-muted-foreground truncate" dir="ltr">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-600 rounded transition-all"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
