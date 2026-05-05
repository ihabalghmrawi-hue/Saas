import Link from 'next/link'
import { ShieldOff, Phone } from 'lucide-react'

export default function BlockedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
          <ShieldOff className="w-10 h-10 text-red-600 dark:text-red-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            تم إيقاف الوصول
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            اشتراكك منتهي أو تم إيقافه
            <br />
            تواصل مع الإدارة لتجديد الاشتراك
          </p>
        </div>

        <div className="bg-card border rounded-2xl p-6 space-y-3">
          <p className="text-sm font-medium text-foreground">للتواصل مع الإدارة:</p>
          <a
            href="tel:01202513941"
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground rounded-xl py-3 font-medium hover:bg-primary/90 transition-colors"
          >
            <Phone className="w-4 h-4" />
            01202513941
          </a>
        </div>

        <Link
          href="/auth/login"
          className="block text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          تسجيل الدخول بحساب آخر
        </Link>
      </div>
    </div>
  )
}
