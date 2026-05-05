import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/rbac'
import Link from 'next/link'
import {
  Building2, CreditCard, Users, ShieldCheck, LayoutDashboard, LogOut,
} from 'lucide-react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Super admin only
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isSuperAdmin(user.email)) {
    redirect('/auth/login?redirectTo=/admin')
  }

  const navItems = [
    { href: '/admin',              label: 'الرئيسية',    icon: LayoutDashboard },
    { href: '/admin/tenants',      label: 'الشركات',     icon: Building2 },
    { href: '/admin/subscriptions',label: 'الاشتراكات',  icon: CreditCard },
    { href: '/admin/users',        label: 'المستخدمون',  icon: Users },
    { href: '/admin/roles',        label: 'الأدوار والصلاحيات', icon: ShieldCheck },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir="rtl">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-700">
          <p className="font-bold text-sm">لوحة الإدارة</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{user.email}</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-slate-700">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            العودة للنظام
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}
