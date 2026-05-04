import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { Calendar, Shirt, AlertTriangle, CheckCircle, Clock, TrendingUp, ArrowUpRight } from 'lucide-react'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function RentalDashboardPage() {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const [
    { data: dresses },
    { data: orders },
    { data: upcoming },
    { data: late },
  ] = await Promise.all([
    supabase.from('dresses').select('status').eq('company_id', COMPANY_ID).neq('status', 'retired'),
    supabase.from('rental_orders').select('total_price, deposit, amount_paid, status').eq('company_id', COMPANY_ID),
    supabase.from('rental_orders')
      .select('*, dresses(name, code, color, category)')
      .eq('company_id', COMPANY_ID).eq('status', 'booked')
      .gte('start_date', today).lte('start_date', in7Days)
      .order('start_date'),
    supabase.from('rental_orders')
      .select('*, dresses(name, code, color, category)')
      .eq('company_id', COMPANY_ID).eq('status', 'active')
      .lt('end_date', today)
      .order('end_date'),
  ])

  const available = dresses?.filter(d => d.status === 'available').length || 0
  const rented = dresses?.filter(d => d.status === 'rented').length || 0
  const maintenance = dresses?.filter(d => d.status === 'maintenance').length || 0
  const totalRevenue = orders?.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_price), 0) || 0
  const pending = orders?.filter(o => ['booked', 'active'].includes(o.status)).reduce((s, o) => s + Number(o.total_price) - Number(o.amount_paid), 0) || 0

  const stats = [
    { label: 'فساتين متاحة', value: available, icon: Shirt, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'مؤجرة الآن', value: rented, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'إجمالي الإيرادات', value: formatCurrency(totalRevenue, CURRENCY), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', isText: true },
    { label: 'مدفوعات معلقة', value: formatCurrency(pending, CURRENCY), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', isText: true },
  ]

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">👰 لوحة تحكم التأجير</h1>
          <p className="text-sm text-muted-foreground">{dresses?.length || 0} فستان إجمالاً · {maintenance} في الصيانة</p>
        </div>
        <Link href="/dashboard/rentals/bookings/new"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> حجز جديد
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className={`${s.bg} rounded-2xl p-4`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Late Returns */}
        <div className="bg-card border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b bg-red-50 dark:bg-red-900/20">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h3 className="font-semibold text-sm text-red-700 dark:text-red-400">متأخرات الإرجاع ({late?.length || 0})</h3>
          </div>
          {!late?.length ? (
            <div className="flex items-center gap-2 p-5 text-green-600 text-sm">
              <CheckCircle className="w-4 h-4" /> لا توجد تأخيرات 🎉
            </div>
          ) : (
            <div className="divide-y divide-border">
              {late.map(o => {
                const d = o.dresses as any
                const lateDays = Math.floor((Date.now() - new Date(o.end_date).getTime()) / 86400000)
                return (
                  <div key={o.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{o.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{d?.name} · {d?.code}</p>
                    </div>
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                      متأخر {lateDays} يوم
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming Bookings */}
        <div className="bg-card border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> حجوزات قادمة (٧ أيام)
            </h3>
            <Link href="/dashboard/rentals/bookings" className="text-xs text-primary flex items-center gap-1 hover:underline">
              الكل <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {!upcoming?.length ? (
            <div className="p-5 text-sm text-muted-foreground text-center">لا توجد حجوزات قادمة</div>
          ) : (
            <div className="divide-y divide-border">
              {upcoming.map(o => {
                const d = o.dresses as any
                return (
                  <div key={o.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{o.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{d?.name} · {new Date(o.start_date).toLocaleDateString('ar-SA')}</p>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      {formatCurrency(o.total_price, CURRENCY)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: '/dashboard/rentals/dresses', label: 'إدارة الفساتين', icon: '👗', desc: `${dresses?.length || 0} فستان` },
          { href: '/dashboard/rentals/bookings', label: 'الحجوزات', icon: '📅', desc: `${orders?.filter(o => o.status === 'booked').length || 0} حجز نشط` },
          { href: '/dashboard/rentals/returns', label: 'الإرجاعات', icon: '🔄', desc: `${orders?.filter(o => o.status === 'active').length || 0} بانتظار الإرجاع` },
        ].map(link => (
          <Link key={link.href} href={link.href}
            className="bg-card border rounded-2xl p-4 hover:border-primary/40 hover:shadow-md transition-all group">
            <span className="text-2xl">{link.icon}</span>
            <p className="font-semibold text-sm mt-2 group-hover:text-primary transition-colors">{link.label}</p>
            <p className="text-xs text-muted-foreground">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
