import * as React from 'react'
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-md shimmer', className)}
      {...props}
    />
  )
}

function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border bg-card p-6', className)} {...props}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}

function SkeletonTable({ rows = 5, columns = 4, className }: { rows?: number; columns?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export { Skeleton, SkeletonCard, SkeletonTable }
