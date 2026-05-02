'use client'

import Link from 'next/link'
import { Plus, FileText, BarChart3, BookOpen } from 'lucide-react'

interface QuickActionsProps {
  companyId: string
}

export function QuickActions({ companyId }: QuickActionsProps) {
  const actions = [
    {
      label: 'قيد جديد',
      description: 'إضافة معاملة',
      href: '/dashboard/transactions/new',
      icon: Plus,
      color: 'bg-primary text-white hover:bg-primary/90',
    },
    {
      label: 'قيد محاسبي',
      description: 'قيد يومية',
      href: '/dashboard/journal/new',
      icon: BookOpen,
      color: 'bg-purple-600 text-white hover:bg-purple-700',
    },
    {
      label: 'التقارير',
      description: 'عرض التقارير',
      href: '/dashboard/reports',
      icon: BarChart3,
      color: 'bg-emerald-600 text-white hover:bg-emerald-700',
    },
    {
      label: 'كشف حساب',
      description: 'طباعة التقرير',
      href: '/dashboard/reports?type=statement',
      icon: FileText,
      color: 'bg-orange-500 text-white hover:bg-orange-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.href}
            href={action.href}
            className={`flex items-center gap-3 p-4 rounded-xl transition-all duration-150 shadow-sm hover:shadow-md ${action.color}`}
          >
            <div className="bg-white/20 p-2 rounded-lg">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">{action.label}</p>
              <p className="text-xs opacity-80">{action.description}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
