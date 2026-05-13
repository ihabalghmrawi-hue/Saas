'use client'

import { cn } from '@/lib/utils'
import { ChevronLeft, type LucideIcon } from 'lucide-react'
import Link from 'next/link'

export interface BreadcrumbItem {
  label: string
  href?: string
  icon?: LucideIcon
}

interface EnterpriseBreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function EnterpriseBreadcrumbs({ items, className }: EnterpriseBreadcrumbsProps) {
  return (
    <nav className={cn('flex items-center gap-1 text-sm', className)}>
      {items.map((item, idx) => {
        const Icon = item.icon
        const isLast = idx === items.length - 1
        return (
          <div key={idx} className="flex items-center gap-1">
            {idx > 0 && <ChevronLeft className="h-4 w-4 text-muted-foreground" />}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span>{item.label}</span>
              </Link>
            ) : (
              <span className={cn(
                'flex items-center gap-1',
                isLast ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}>
                {Icon && <Icon className="h-4 w-4" />}
                <span>{item.label}</span>
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}
