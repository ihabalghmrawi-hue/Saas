'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Keyboard, X, Command, ArrowUp, ArrowDown, Plus, Search, Slash } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface KeyboardShortcutsHelpProps {
  open: boolean
  onClose: () => void
  shortcuts: { key: string; description: string; category: string }[]
}

const DEFAULT_SHORTCUTS = [
  { key: '⌘K', description: 'فتح لوحة الأوامر', category: 'عام' },
  { key: '⌘⇧F', description: 'بحث شامل', category: 'عام' },
  { key: 'Esc', description: 'إغلاق اللوحة المنبثقة', category: 'عام' },
  { key: '↑↓', description: 'التنقل بين العناصر', category: 'التنقل' },
  { key: 'Tab', description: 'الانتقال إلى الحقل التالي', category: 'التنقل' },
  { key: '⌘W', description: 'إغلاق التبويب الحالي', category: 'التنقل' },
  { key: 'Enter', description: 'تأكيد الإجراء', category: 'الإجراءات' },
  { key: 'Space', description: 'تحديد/إلغاء تحديد', category: 'الإجراءات' },
  { key: 'Delete', description: 'حذف العنصر المحدد', category: 'الإجراءات' },
  { key: '⌘S', description: 'حفظ التغييرات', category: 'العمليات' },
  { key: '⌘P', description: 'طباعة', category: 'العمليات' },
  { key: '⌘Z', description: 'تراجع عن آخر إجراء', category: 'العمليات' },
  { key: '⌘⇧Z', description: 'إعادة الإجراء', category: 'العمليات' },
  { key: '⌘A', description: 'فتح مركز النشاطات', category: 'العمل' },
  { key: '⌘N', description: 'فتح التنبيهات', category: 'العمل' },
]

const CATEGORY_ORDER = ['عام', 'التنقل', 'الإجراءات', 'العمليات', 'العمل']

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
}

function normalizeKey(key: string): string {
  const mac = isMac()
  return key
    .replace(/⌘/g, mac ? '⌘' : 'Ctrl+')
    .replace(/⇧/g, mac ? '⇧' : 'Shift+')
    .replace(/⌥/g, mac ? '⌥' : 'Alt+')
}

export function KeyboardShortcutsHelp({ open, onClose, shortcuts = DEFAULT_SHORTCUTS }: KeyboardShortcutsHelpProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setIsVisible(true)
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200)
      return () => clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        onClose()
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault()
          if (open) onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!isVisible) return null

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    items: shortcuts.filter(s => s.category === cat),
  })).filter(g => g.items.length > 0)

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center',
        open ? 'animate-fade-in' : 'animate-fade-out'
      )}
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full max-w-2xl bg-background border rounded-t-2xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto',
          open ? 'animate-slide-up' : 'animate-slide-down'
        )}
        dir="rtl"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Keyboard className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">اختصارات لوحة المفاتيح</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-6 px-1">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {isMac() ? '⌘ = Command' : 'Ctrl'}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {isMac() ? '⇧ = Shift' : 'Shift'}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            اضغط ? للفتح
          </span>
        </div>

        <div className="space-y-6">
          {grouped.map(({ category, items }) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                {category}
              </h3>
              <div className="space-y-1">
                {items.map((shortcut, idx) => (
                  <div
                    key={`${shortcut.key}-${idx}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <kbd className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium bg-muted border rounded-md text-foreground">
                      {normalizeKey(shortcut.key)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-xs text-muted-foreground">
            اضغط على Esc أو ? للإغلاق
          </p>
        </div>
      </div>
    </div>
  )
}

export { DEFAULT_SHORTCUTS }
