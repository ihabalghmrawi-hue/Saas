import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, BookMarked, Scale,
  List, BarChart3, Calendar,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard/accounting',               label: 'لوحة التحكم',      icon: LayoutDashboard },
  { href: '/dashboard/accounting/journal',       label: 'القيود المحاسبية', icon: BookOpen },
  { href: '/dashboard/accounting/ledger',        label: 'دفتر الأستاذ',     icon: BookMarked },
  { href: '/dashboard/accounting/trial-balance', label: 'ميزان المراجعة',   icon: Scale },
  { href: '/dashboard/accounting/coa',           label: 'شجرة الحسابات',    icon: List },
  { href: '/dashboard/accounting/statements',    label: 'القوائم المالية',   icon: BarChart3 },
  { href: '/dashboard/accounting/periods',       label: 'الفترات المالية',   icon: Calendar },
]

function AccountingSidebar() {
  return (
    <aside className="w-56 bg-white border-l border-gray-200 min-h-screen flex-shrink-0">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-600" />
          المحاسبة
        </h2>
      </div>
      <nav className="p-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors group"
            >
              <Icon className="h-4 w-4 flex-shrink-0 group-hover:text-blue-600" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      <AccountingSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
