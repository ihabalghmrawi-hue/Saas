'use client'

import { useState, useEffect, useRef } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TooltipHintProps {
  id:         string       // unique id, stored in localStorage
  content:    string
  position?:  'top' | 'bottom' | 'left' | 'right'
  children?:  React.ReactNode
  className?: string
}

export function TooltipHint({ id, content, position = 'top', children, className }: TooltipHintProps) {
  const [seen,    setSeen]    = useState(true)  // start hidden to avoid flash
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wasSeen = localStorage.getItem(`erp_hint_${id}`)
    if (!wasSeen) setSeen(false)
  }, [id])

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSeen(true)
    localStorage.setItem(`erp_hint_${id}`, '1')
    setVisible(false)
  }

  if (seen) return children ? <>{children}</> : null

  const posClasses = {
    top:    'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left:   'right-full mr-2 top-1/2 -translate-y-1/2',
    right:  'left-full ml-2 top-1/2 -translate-y-1/2',
  }

  return (
    <div ref={ref} className={cn('relative inline-flex items-center', className)}>
      {children}
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible(v => !v)}
        className="mr-1.5 text-primary animate-pulse hover:animate-none transition-all"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {visible && (
        <div className={cn('absolute z-50 w-56 bg-popover border shadow-xl rounded-xl p-3 text-xs', posClasses[position])}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-foreground leading-relaxed">{content}</p>
            <button onClick={dismiss} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
          <button onClick={dismiss} className="text-primary hover:underline text-[10px] mt-1">
            فهمت، لا تُظهر مجدداً
          </button>
        </div>
      )}

      {/* Pulse dot to attract attention */}
      {!visible && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-ping opacity-75 pointer-events-none" />
      )}
    </div>
  )
}
