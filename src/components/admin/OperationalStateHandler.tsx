'use client'

import { cn } from '@/lib/utils'
import { Loader2, AlertCircle, Inbox, RefreshCw, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OperationalStateHandlerProps {
  loading?: boolean
  loadingText?: string
  error?: string | null
  onRetry?: () => void
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: React.ComponentType<{ className?: string }>
  onEmptyAction?: () => void
  emptyActionLabel?: string
  noResults?: boolean
  searchQuery?: string
  children?: React.ReactNode
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4" role="status">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4" role="alert">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-foreground">حدث خطأ</h3>
        <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          إعادة المحاولة
        </Button>
      )}
    </div>
  )
}

function EmptyState({
  title,
  description,
  icon: Icon,
  onAction,
  actionLabel,
}: {
  title: string
  description: string
  icon?: React.ComponentType<{ className?: string }>
  onAction?: () => void
  actionLabel?: string
}) {
  const IconComponent = Icon || Inbox
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="rounded-full bg-muted p-4">
        <IconComponent className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      </div>
      {onAction && actionLabel && (
        <Button variant="outline" onClick={onAction} className="gap-2">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

function NoResultsState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="rounded-full bg-muted p-4">
        <SearchX className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          لا توجد نتائج لـ &ldquo;{query}&rdquo;
        </h3>
        <p className="text-sm text-muted-foreground">
          حاول تعديل معايير البحث أو استخدم كلمات مختلفة
        </p>
      </div>
      <Button variant="outline" onClick={onClear} className="gap-2">
        <SearchX className="h-4 w-4" />
        مسح البحث
      </Button>
    </div>
  )
}

export function OperationalStateHandler({
  loading,
  loadingText = 'جاري التحميل...',
  error,
  onRetry,
  empty = false,
  emptyTitle = 'لا توجد بيانات',
  emptyDescription = 'لم يتم العثور على أي عناصر لعرضها',
  emptyIcon,
  onEmptyAction,
  emptyActionLabel,
  noResults = false,
  searchQuery = '',
  children,
}: OperationalStateHandlerProps) {
  if (loading) {
    return <LoadingState text={loadingText} />
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />
  }

  if (noResults) {
    return (
      <NoResultsState
        query={searchQuery}
        onClear={() => {
          if (onEmptyAction) onEmptyAction()
        }}
      />
    )
  }

  if (empty) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        onAction={onEmptyAction}
        actionLabel={emptyActionLabel}
      />
    )
  }

  return <div className="animate-fade-in">{children}</div>
}
