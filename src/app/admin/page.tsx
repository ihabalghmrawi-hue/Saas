import { createClient } from '@/lib/supabase/server'
import { Building2, Users, CreditCard, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = createClient()

  const [companies, subscriptions, memberships] = await Promise.all([
    supabase.from('companies').select('id', { count: 'exact', head: true }),
    supabase.from('subscriptions').select('status'),
    supabase.from('memberships').select('id', { count: 'exact', head: true }),
  ])

  const totalCompanies = companies.count ?? 0
  const totalUsers     = memberships.count ?? 0
  const subs           = subscriptions.data ?? []
  const activeSubs     = subs.filter(s => s.status === 'active').length
  const expiredSubs    = subs.filter(s => s.status === 'expired' || s.status === 'suspended').length

  const stats = [
    { label: 'الشركات',         value: totalCompanies, icon: Building2,     color: 'bg-blue-50 text-blue-600',   href: '/admin/tenants' },
    { label: 'المستخدمون',      value: totalUsers,     icon: Users,          color: 'bg-green-50 text-green-600', href: '/admin/users' },
    { label: 'اشتراكات نشطة',   value: activeSubs,     icon: CreditCard,     color: 'bg-purple-50 text-purple-600',href: '/admin/subscriptions' },
    { label: 'اشتراكات منتهية', value: expiredSubs,    icon: AlertTriangle,  color: 'bg-red-50 text-red-600',     href: '/admin/subscriptions' },
  ]

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم الرئيسية</h1>
        <p className="text-muted-foreground text-sm mt-1">نظرة عامة على النظام</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Link key={s.label} href={s.href}
            className="bg-card border rounded-2xl p-5 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
