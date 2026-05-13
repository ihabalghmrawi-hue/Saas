'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Package, Warehouse, MoveHorizontal, ClipboardList,
  BarChart3, Scale, Truck, ShoppingCart,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard/inventory',          label: 'لوحة التحكم',     icon: Package },
  { href: '/dashboard/inventory/items',    label: 'الأصناف',         icon: ClipboardList },
  { href: '/dashboard/inventory/movements',label: 'حركة المخزون',    icon: Scale },
  { href: '/dashboard/inventory/transfers',label: 'التحويلات',       icon: Truck },
  { href: '/dashboard/inventory/reports',  label: 'التقارير',        icon: BarChart3 },
]

export default function InventoryLayout({
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
            <Package className="h-4 w-4 text-blue-600" />
            المخزون
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
