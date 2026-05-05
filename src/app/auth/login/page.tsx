'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react'

function LoginForm() {
  const router = useRouter()

  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [checking,     setChecking]     = useState(true)
  const [error,        setError]        = useState('')
  const didRedirect = useRef(false)

  // Check if already logged in — max 3s wait, then show form regardless
  useEffect(() => {
    const timer = setTimeout(() => setChecking(false), 3000)
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        clearTimeout(timer)
        if (user && !didRedirect.current) {
          didRedirect.current = true
          router.replace('/dashboard')
        } else {
          setChecking(false)
        }
      })
      .catch(() => { clearTimeout(timer); setChecking(false) })
    return () => clearTimeout(timer)
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await createClient().auth.signInWithPassword({ email, password })
    if (err) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
      setLoading(false)
      return
    }
    // Small pause so the session cookie is written before navigation
    await new Promise(r => setTimeout(r, 300))
    router.push('/dashboard')
    router.refresh()
  }

  if (checking) {
    return (
      <div className="bg-card rounded-2xl border shadow-xl p-8 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="bg-card rounded-2xl border shadow-xl p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold">تسجيل الدخول</h2>
        <p className="text-muted-foreground text-sm mt-1">أدخل بياناتك للوصول إلى حسابك</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">البريد الإلكتروني</label>
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com" required dir="ltr"
              className="w-full border border-input bg-background rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">كلمة المرور</label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type={showPassword ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" required dir="ltr"
              className="w-full border border-input bg-background rounded-lg px-4 py-2.5 pr-10 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري تسجيل الدخول...</> : 'تسجيل الدخول'}
        </button>
      </form>

      <div className="mt-6 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          ليس لديك حساب؟{' '}
          <Link href="/auth/signup" className="text-primary font-medium hover:underline">إنشاء حساب</Link>
        </p>
        <Link href="/staff-login" className="block text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
          دخول الموظفين (رقم سري)
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="bg-card rounded-2xl border shadow-xl p-8 animate-pulse h-64" />}>
      <LoginForm />
    </Suspense>
  )
}
