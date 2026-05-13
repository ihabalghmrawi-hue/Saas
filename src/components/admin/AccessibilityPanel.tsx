'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Accessibility, Eye, EyeOff, ZoomIn, ZoomOut, Type, Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AccessibilityPanelProps {
  open: boolean
  onClose: () => void
}

interface A11ySettings {
  highContrast: boolean
  fontSize: 'small' | 'normal' | 'large' | 'x-large'
  letterSpacing: boolean
  reducedMotion: boolean
  focusIndicator: boolean
  grayscale: boolean
}

const STORAGE_KEY = 'financeapp_a11y_settings'

const DEFAULT_SETTINGS: A11ySettings = {
  highContrast: false,
  fontSize: 'normal',
  letterSpacing: false,
  reducedMotion: false,
  focusIndicator: true,
  grayscale: false,
}

const FONT_SIZE_MAP: Record<A11ySettings['fontSize'], string> = {
  small: 'text-sm',
  normal: 'text-base',
  large: 'text-lg',
  'x-large': 'text-xl',
}

function loadSettings(): A11ySettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    }
  } catch {}
  return DEFAULT_SETTINGS
}

function saveSettings(settings: A11ySettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {}
}

function applyGlobalStyles(settings: A11ySettings) {
  const root = document.documentElement

  root.style.setProperty('--a11y-font-size', FONT_SIZE_MAP[settings.fontSize])
  root.style.setProperty('--a11y-letter-spacing', settings.letterSpacing ? '0.05em' : 'normal')

  root.classList.toggle('a11y-high-contrast', settings.highContrast)
  root.classList.toggle('a11y-reduced-motion', settings.reducedMotion)
  root.classList.toggle('a11y-focus-indicator', settings.focusIndicator)
  root.classList.toggle('a11y-grayscale', settings.grayscale)

  if (settings.reducedMotion) {
    root.style.setProperty('--a11y-animation-duration', '0.001ms')
  } else {
    root.style.setProperty('--a11y-animation-duration', '')
  }
}

interface ToggleRowProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  icon: React.ReactNode
}

function ToggleRow({ label, description, checked, onChange, icon }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn('rounded-lg p-2', checked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          checked ? 'bg-primary' : 'bg-input'
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  )
}

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  icon: React.ReactNode
  displayValue: string
}

function SliderRow({ label, value, min, max, step, onChange, icon, displayValue }: SliderRowProps) {
  return (
    <div className="py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2 bg-muted text-muted-foreground">
            {icon}
          </div>
          <p className="text-sm font-medium text-foreground">{label}</p>
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {displayValue}
        </span>
      </div>
      <div className="flex items-center gap-3 mr-14">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          className="rounded-lg p-1 hover:bg-muted transition-colors disabled:opacity-30"
        >
          <ZoomOut className="h-4 w-4 text-muted-foreground" />
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
          dir="ltr"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          className="rounded-lg p-1 hover:bg-muted transition-colors disabled:opacity-30"
        >
          <ZoomIn className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}

export function AccessibilityPanel({ open, onClose }: AccessibilityPanelProps) {
  const [settings, setSettings] = useState<A11ySettings>(DEFAULT_SETTINGS)
  const [fontSizeIndex, setFontSizeIndex] = useState(1)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const loaded = loadSettings()
    setSettings(loaded)
    applyGlobalStyles(loaded)

    const sizes: A11ySettings['fontSize'][] = ['small', 'normal', 'large', 'x-large']
    setFontSizeIndex(sizes.indexOf(loaded.fontSize))
  }, [])

  useEffect(() => {
    if (!mounted) return
    saveSettings(settings)
    applyGlobalStyles(settings)
  }, [settings, mounted])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const updateSetting = useCallback(<K extends keyof A11ySettings>(
    key: K,
    value: A11ySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    const sizes: A11ySettings['fontSize'][] = ['small', 'normal', 'large', 'x-large']
    setFontSizeIndex(sizes.indexOf(DEFAULT_SETTINGS.fontSize))
  }, [])

  const handleFontSizeChange = useCallback((idx: number) => {
    setFontSizeIndex(idx)
    const sizes: A11ySettings['fontSize'][] = ['small', 'normal', 'large', 'x-large']
    updateSetting('fontSize', sizes[idx])
  }, [updateSetting])

  if (!mounted || !open) return null

  const fontSizeLabels = ['صغير', 'عادي', 'كبير', 'كبير جداً']

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex',
        'animate-fade-in'
      )}
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full max-w-sm bg-background border-l shadow-2xl h-full overflow-y-auto',
          'animate-slide-in-right'
        )}
        dir="rtl"
      >
        <div className="sticky top-0 bg-background border-b z-10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Accessibility className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">إمكانية الوصول</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <EyeOff className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-1">
          <ToggleRow
            label="التباين العالي"
            description="زيادة تباين الألوان للنصوص والخلفيات"
            checked={settings.highContrast}
            onChange={v => updateSetting('highContrast', v)}
            icon={<Eye className="h-4 w-4" />}
          />

          <SliderRow
            label="تكبير النص"
            value={fontSizeIndex}
            min={0}
            max={3}
            step={1}
            onChange={handleFontSizeChange}
            icon={<Type className="h-4 w-4" />}
            displayValue={fontSizeLabels[fontSizeIndex]}
          />

          <ToggleRow
            label="تباعد الأحرف"
            description="زيادة المسافة بين الحروف لتحسين القراءة"
            checked={settings.letterSpacing}
            onChange={v => updateSetting('letterSpacing', v)}
            icon={<Type className="h-4 w-4" />}
          />

          <ToggleRow
            label="تقليل الحركة"
            description="إيقاف الرسوم المتحركة والتأثيرات الحركية"
            checked={settings.reducedMotion}
            onChange={v => updateSetting('reducedMotion', v)}
            icon={<Sun className="h-4 w-4" />}
          />

          <ToggleRow
            label="التركيز المرئي"
            description="إظهار إطار حول العنصر المحدد"
            checked={settings.focusIndicator}
            onChange={v => updateSetting('focusIndicator', v)}
            icon={<Eye className="h-4 w-4" />}
          />

          <ToggleRow
            label="وضع التدرج الرمادي"
            description="تحويل جميع الألوان إلى تدرجات رمادية"
            checked={settings.grayscale}
            onChange={v => updateSetting('grayscale', v)}
            icon={<Monitor className="h-4 w-4" />}
          />
        </div>

        <div className="p-4 border-t mt-4">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              className="flex-1"
            >
              إعادة ضبط الإعدادات
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1"
            >
              إغلاق
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">
            يتم حفظ الإعدادات تلقائياً
          </p>
        </div>
      </div>
    </div>
  )
}
