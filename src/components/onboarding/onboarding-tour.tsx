'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TourStep {
  title:    string
  body:     string
  target?:  string          // CSS selector to spotlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  emoji?:   string
}

interface OnboardingTourProps {
  tourKey:  string          // unique key per business type, stored in localStorage
  steps:    TourStep[]
}

function useSpotlight(selector: string | undefined) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!selector) { setRect(null); return }
    const el = document.querySelector(selector)
    if (el) {
      setRect(el.getBoundingClientRect())
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    const onResize = () => {
      const el2 = document.querySelector(selector)
      if (el2) setRect(el2.getBoundingClientRect())
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [selector])
  return rect
}

const PAD = 8

export function OnboardingTour({ tourKey, steps }: OnboardingTourProps) {
  const [active, setActive] = useState(false)
  const [idx,    setIdx]    = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined' && !localStorage.getItem(`erp_tour_${tourKey}`)) {
      setTimeout(() => setActive(true), 800) // slight delay so page renders
    }
  }, [tourKey])

  const finish = useCallback(() => {
    setActive(false)
    localStorage.setItem(`erp_tour_${tourKey}`, '1')
  }, [tourKey])

  const step   = steps[idx]
  const isLast = idx === steps.length - 1
  const rect   = useSpotlight(active ? step?.target : undefined)

  if (!mounted || !active) return null

  // ── Spotlight clipping ──────────────────────────────────────────────────
  const spotlightStyle = rect
    ? {
        top:    rect.top    - PAD,
        left:   rect.left   - PAD,
        width:  rect.width  + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null

  // ── Tooltip positioning ─────────────────────────────────────────────────
  const getTooltipStyle = (): React.CSSProperties => {
    if (!rect || step.position === 'center' || !step.target) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }
    const pos = step.position || 'bottom'
    const TW = 320, TH = 200
    const vw = window.innerWidth, vh = window.innerHeight

    if (pos === 'bottom') return {
      top:  Math.min(rect.bottom + PAD + 8, vh - TH - 10),
      left: Math.max(10, Math.min(rect.left + rect.width / 2 - TW / 2, vw - TW - 10)),
    }
    if (pos === 'top') return {
      top:  Math.max(10, rect.top - TH - PAD - 8),
      left: Math.max(10, Math.min(rect.left + rect.width / 2 - TW / 2, vw - TW - 10)),
    }
    if (pos === 'right') return {
      top:  Math.max(10, rect.top + rect.height / 2 - TH / 2),
      left: Math.min(rect.right + PAD + 8, vw - TW - 10),
    }
    if (pos === 'left') return {
      top:  Math.max(10, rect.top + rect.height / 2 - TH / 2),
      left: Math.max(10, rect.left - TW - PAD - 8),
    }
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }

  return (
    <>
      {/* ── Overlay with cutout ── */}
      <div className="fixed inset-0 z-[60] pointer-events-none">
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60 transition-all duration-300" />
        {/* Spotlight cutout */}
        {spotlightStyle && (
          <div
            className="absolute bg-transparent rounded-xl ring-4 ring-primary/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] transition-all duration-300 pointer-events-none"
            style={spotlightStyle}
          />
        )}
      </div>

      {/* ── Click through on spotlight element ── */}
      {spotlightStyle && (
        <div className="fixed z-[61] rounded-xl pointer-events-auto cursor-pointer" style={spotlightStyle} onClick={() => {}} />
      )}

      {/* ── Tooltip card ── */}
      <div
        className="fixed z-[62] w-80 bg-card border shadow-2xl rounded-2xl overflow-hidden pointer-events-auto"
        style={getTooltipStyle()}
      >
        {/* Top accent */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />

        <div className="p-5">
          {/* Step counter */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div key={i} className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === idx ? 'w-6 bg-primary' : i < idx ? 'w-3 bg-primary/40' : 'w-3 bg-muted'
                )} />
              ))}
            </div>
            <button onClick={finish} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="flex items-start gap-3 mb-4">
            {step.emoji && (
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-xl shrink-0">
                {step.emoji}
              </div>
            )}
            <div>
              <h3 className="font-bold text-base mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {idx > 0 && (
              <button onClick={() => setIdx(i => i - 1)}
                className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4" /> السابق
              </button>
            )}
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">{idx + 1} / {steps.length}</span>
            <button
              onClick={() => isLast ? finish() : setIdx(i => i + 1)}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {isLast ? (
                <><Sparkles className="w-4 h-4" /> ابدأ الآن!</>
              ) : (
                <>التالي <ChevronLeft className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
