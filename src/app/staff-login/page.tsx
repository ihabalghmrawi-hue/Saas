'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShoppingCart, Delete, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'المتجر'

const KEYS = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['del','0','✓'],
]

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [welcome, setWelcome] = useState('')

  const handleLogin = async (code: string) => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error
        setError(typeof msg === 'string' ? msg : (msg?.message || 'رقم سري خاطئ'))
        setPin('')
        setLoading(false)
        return
      }
      // Show welcome message briefly before redirect
      const name = data.name || 'بك'
      setWelcome(`مرحباً ${name}! 👋`)
      setTimeout(() => {
        const from = params.get('from') || '/dashboard'
        router.replace(from)
      }, 900)
    } catch {
      setError('حدث خطأ في الاتصال')
      setPin('')
      setLoading(false)
    }
  }

  const handleKey = (key: string) => {
    if (key === 'del') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 6) return
    const newPin = pin + key
    setPin(newPin)
    if (newPin.length >= 4) handleLogin(newPin)
  }

  return (
    <div className="bg-card border rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex justify-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all',
              i < pin.length
                ? 'bg-primary border-primary shadow-sm'
                : 'border-border bg-background'
            )}
          >
            {i < pin.length && <div className="w-3 h-3 bg-white rounded-full" />}
          </div>
        ))}
      </div>

      {welcome && (
        <div className="flex items-center justify-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm font-semibold p-3 rounded-xl animate-pulse">
          {welcome}
        </div>
      )}

      {error && !welcome && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm p-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {KEYS.flat().map((key) => (
          <button
            key={key}
            onClick={() => !loading && handleKey(key)}
            disabled={loading}
            className={cn(
              'h-14 rounded-xl text-lg font-bold transition-all active:scale-95 select-none',
              key === 'del'
                ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                : key === '✓'
                  ? 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                  : 'bg-accent hover:bg-accent/80 text-foreground'
            )}
          >
            {loading && key === '✓' ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : key === 'del' ? (
              <Delete className="w-5 h-5 mx-auto" />
            ) : (
              key
            )}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        المدير: 1234 (قابل للتغيير من .env)
      </p>
    </div>
  )
}

export default function StaffLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">{COMPANY_NAME}</h1>
          <p className="text-muted-foreground text-sm mt-1">أدخل رقمك السري للدخول</p>
        </div>
        <Suspense fallback={<div className="h-64 bg-card border rounded-2xl animate-pulse" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
