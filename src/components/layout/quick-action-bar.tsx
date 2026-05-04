'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ShoppingCart, Calendar, Plus, User, Package,
  DollarSign, RotateCcw, Shirt,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Features } from '@/lib/features'

interface Action {
  label: string
  href: string
  icon: React.ElementType
  primary?: boolean
  color: string
}

function getActions(features: Features): Action[] {
  if (features.hasRental) {
    return [
      { label: 'حجز جديد',    href: '/dashboard/rentals/bookings/new', icon: Calendar, primary: true,  color: 'bg-primary text-primary-foreground hover:bg-primary/90' },
      { label: 'فستان جديد',  href: '/dashboard/rentals/dresses',      icon: Shirt,    primary: false, color: 'bg-card border hover:bg-accent hover:border-primary/30 text-foreground' },
      { label: 'التقويم',     href: '/dashboard/rentals/calendar',     icon: Calendar, primary: false, color: 'bg-card border hover:bg-accent hover:border-primary/30 text-foreground' },
      { label: 'إرجاع',       href: '/dashboard/rentals/returns',      icon: RotateCcw,primary: false, color: 'bg-card border hover:bg-accent hover:border-primary/30 text-foreground' },
    ]
  }
  const actions: Action[] = []
  if (features.showPOS) actions.push({ label: 'بيع جديد', href: '/dashboard/pos', icon: ShoppingCart, primary: true, color: 'bg-primary text-primary-foreground hover:bg-primary/90' })
  actions.push({ label: 'منتج جديد',   href: '/dashboard/inventory',  icon: Package,    primary: !features.showPOS, color: features.showPOS ? 'bg-card border hover:bg-accent text-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90' })
  actions.push({ label: 'عميل جديد',   href: '/dashboard/customers',  icon: User,       primary: false, color: 'bg-card border hover:bg-accent hover:border-primary/30 text-foreground' })
  if (features.showPurchases) actions.push({ label: 'فاتورة شراء', href: '/dashboard/purchases', icon: Plus, primary: false, color: 'bg-card border hover:bg-accent hover:border-primary/30 text-foreground' })
  actions.push({ label: 'مصروف',       href: '/dashboard/expenses',   icon: DollarSign, primary: false, color: 'bg-card border hover:bg-accent hover:border-primary/30 text-foreground' })
  return actions
}

// Pages where the bar should be hidden (they have their own full-screen UI)
const HIDDEN_PATHS = ['/dashboard/pos', '/dashboard/rentals/bookings/new']

export function QuickActionBar({ features }: { features: Features }) {
  const pathname = usePathname()
  if (HIDDEN_PATHS.some(p => pathname.startsWith(p))) return null

  const actions = getActions(features)

  return (
    <div data-tour="quick-action-bar" className="flex items-center gap-2 px-4 py-2 border-b bg-card/80 backdrop-blur shrink-0 overflow-x-auto scrollbar-none">
      {actions.map(action => {
        const Icon = action.icon
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shrink-0 whitespace-nowrap',
              action.primary ? 'shadow-sm' : '',
              action.color
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {action.label}
          </Link>
        )
      })}
    </div>
  )
}
