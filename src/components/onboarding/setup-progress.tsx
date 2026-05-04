'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SetupStep {
  id:       string
  label:    string
  desc:     string
  href?:    string
  action?:  string
  done:     boolean
}

interface SetupProgressProps {
  steps:       SetupStep[]
  businessType: string
}

export function SetupProgress({ steps, businessType }: SetupProgressProps) {
  const [open,       setOpen]       = useState(false)
  const [dismissed,  setDismissed]  = useState(false)
  const [mounted,    setMounted]    = useState(false)

  useEffect(() => {
    setMounted(true)
    const key = `erp_setup_dismissed_${businessType}`
    if (typeof window !== 'undefined' && localStorage.getItem(key)) setDismissed(true)
    // Auto-open if < 80% done and not dismissed
  }, [businessType])

  const done  = steps.filter(s => s.done).length
  const total = steps.length
  const pct   = Math.round((done / total) * 100)
  const allDone = done === total

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem(`erp_setup_dismissed_${businessType}`, '1')
  }

  if (!mounted || dismissed || allDone) return null

  return (
    <div className={cn(
      'fixed bottom-5 left-5 z-40 w-80 bg-card border shadow-2xl rounded-2xl overflow-hidden transition-all duration-300',
      open ? 'shadow-primary/10' : ''
    )}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none bg-gradient-to-l from-primary/5 to-transparent hover:bg-primary/5 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {/* Ring progress */}
        <div className="relative w-10 h-10 shrink-0">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
              strokeDasharray={`${pct * 0.942} 100`}
              strokeLinecap="round"
              className="text-primary transition-all duration-700" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary">{pct}%</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">إعداد النظام</p>
          <p className="text-xs text-muted-foreground">{done} من {total} خطوات مكتملة</p>
        </div>

        <div className="flex items-center gap-1">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
          <button onClick={e => { e.stopPropagation(); dismiss() }}
            className="p-1 hover:bg-muted rounded-lg transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted/30">
        <div className="h-full bg-primary transition-all duration-700 rounded-full" style={{ width: `${pct}%` }} />
      </div>

      {/* Steps list */}
      {open && (
        <div className="divide-y divide-border max-h-72 overflow-y-auto">
          {steps.map((step, i) => (
            <div key={step.id} className={cn(
              'flex items-start gap-3 px-4 py-3 transition-colors',
              step.done ? 'opacity-60' : 'hover:bg-muted/30'
            )}>
              {step.done
                ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                : <Circle       className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', step.done && 'line-through text-muted-foreground')}>{step.label}</p>
                <p className="text-xs text-muted-foreground leading-snug">{step.desc}</p>
                {!step.done && step.href && (
                  <a href={step.href}
                    className="inline-flex items-center gap-1 mt-1.5 text-xs text-primary font-medium hover:underline">
                    <Zap className="w-3 h-3" /> {step.action || 'ابدأ الآن'}
                  </a>
                )}
              </div>
              {!step.done && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{i + 1}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer CTA */}
      {open && pct < 100 && (
        <div className="px-4 py-3 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            أكمل الإعداد للحصول على أفضل تجربة ✨
          </p>
        </div>
      )}
    </div>
  )
}
