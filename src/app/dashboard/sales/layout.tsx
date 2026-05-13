'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ShoppingCart, FileText, CreditCard, Undo2,
  Truck, BarChart3, FileSpreadsheet, ListTodo,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard/sales',            label: 'لوحة التحكم',    icon: ShoppingCart },
  { href: '/dashboard/sales/orders',     label: 'طلبات البيع',    icon: ListTodo },
  { href: '/dashboard/sales/invoices',   label: 'الفواتير',        icon: FileText },
  { href: '/dashboard/sales/payments',   label: 'المدفوعات',       icon: CreditCard },
  { href: '/dashboard/sales/returns',    label: 'المرتجعات',       icon: Undo2 },
  { href: '/dashboard/sales/shipments',  label: 'الشحنات',         icon: Truck },
  { href: '/dashboard/sales/reports',    label: 'التقارير',        icon: BarChart3 },
]

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      <aside className="w-56 bg-white border-l border-gray-200 min-h-screen flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-blue-600" />
            المبيعات
          </h2>
        </div>
        <nav className="p-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors group ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
