'use client'

import { useEffect, useState } from 'react'
import { CreditCard, RefreshCw, PauseCircle, PlayCircle } from 'lucide-react'

interface Sub {
  id: string; status: string; plan: string
  start_date: string; end_date: string | null; notes: string | null
  companies: { id: string; name: string } | null
}

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  expired:   'bg-red-100 text-red-700',
  suspended: 'bg-amber-100 text-amber-700',
  trialing:  'bg-blue-100 text-blue-700',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'نشط', expired: 'منتهي', suspended: 'موقوف', trialing: 'تجريبي',
}

export default function SubscriptionsPage() {
  const [subs, setSubs]     = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing]  = useState<string | null>(null)
  const [extendDays, setExtendDays] = useState<Record<string, number>>({})

  const load = () => {
    setLoading(true)
    fetch('/api/admin/subscriptions').then(r => r.json())
      .then(d => { setSubs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(load, [])

  const update = async (id: string, body: object) => {
    setActing(id)
    await fetch('/api/admin/subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
    setActing(null)
    load()
  }

  const daysLeft = (endDate: string | null) => {
    if (!endDate) return null
    const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
    return diff
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" /> إدارة الاشتراكات
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{subs.length} اشتراك</p>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-right px-4 py-3 font-medium">الشركة</th>
              <th className="text-right px-4 py-3 font-medium">الحالة</th>
              <th className="text-right px-4 py-3 font-medium">الخطة</th>
              <th className="text-right px-4 py-3 font-medium">انتهاء / متبقي</th>
              <th className="text-right px-4 py-3 font-medium">تمديد (أيام)</th>
              <th className="text-right px-4 py-3 font-medium">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">جاري التحميل...</td></tr>
            ) : subs.map(sub => {
              const left = daysLeft(sub.end_date)
              const isActing = acting === sub.id
              return (
                <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{sub.companies?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[sub.status] || sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize">{sub.plan}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {sub.end_date ? new Date(sub.end_date).toLocaleDateString('ar-SA') : '—'}
                    {left !== null && (
                      <span className={`block text-xs ${left < 7 ? 'text-red-500' : left < 30 ? 'text-amber-500' : 'text-green-600'}`}>
                        {left > 0 ? `${left} يوم متبقي` : 'منتهي'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number" min={1} defaultValue={30}
                      className="w-20 border rounded-lg px-2 py-1 text-sm text-center"
                      onChange={e => setExtendDays(d => ({ ...d, [sub.id]: Number(e.target.value) }))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => update(sub.id, { days: extendDays[sub.id] || 30 })}
                        disabled={isActing}
                        title="تمديد"
                        className="p-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      {sub.status === 'active' ? (
                        <button
                          onClick={() => update(sub.id, { status: 'suspended' })}
                          disabled={isActing}
                          title="إيقاف"
                          className="p-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                        >
                          <PauseCircle className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => update(sub.id, { status: 'active' })}
                          disabled={isActing}
                          title="تفعيل"
                          className="p-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
