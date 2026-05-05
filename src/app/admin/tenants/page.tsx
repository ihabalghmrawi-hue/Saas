'use client'

import { useEffect, useState } from 'react'
import { Building2, Plus, CheckCircle2, XCircle, Clock } from 'lucide-react'

interface Tenant {
  id: string; name: string; created_at: string
  subscriptions: { status: string; plan: string; end_date: string | null }[]
}

const STATUS_LABEL: Record<string, string> = {
  active: 'نشط', expired: 'منتهي', suspended: 'موقوف', trialing: 'تجريبي',
}
const STATUS_COLOR: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  expired:   'bg-red-100 text-red-700',
  suspended: 'bg-amber-100 text-amber-700',
  trialing:  'bg-blue-100 text-blue-700',
}

export default function TenantsPage() {
  const [tenants, setTenants]   = useState<Tenant[]>([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm]         = useState({ name: '', plan: 'free', days: 30 })
  const [showForm, setShowForm] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/tenants').then(r => r.json())
      .then(d => { setTenants(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setCreating(false)
    setShowForm(false)
    setForm({ name: '', plan: 'free', days: 30 })
    load()
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> إدارة الشركات
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tenants.length} شركة مسجلة</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> شركة جديدة
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-card border rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold">إنشاء شركة جديدة</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">اسم الشركة</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="اسم الشركة" required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">الخطة</label>
              <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="free">مجاني</option>
                <option value="basic">أساسي</option>
                <option value="pro">احترافي</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">مدة الاشتراك (أيام)</label>
              <input type="number" value={form.days} min={1}
                onChange={e => setForm(f => ({ ...f, days: Number(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {creating ? 'جاري الإنشاء...' : 'إنشاء'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="border px-4 py-2 rounded-lg text-sm">إلغاء</button>
          </div>
        </form>
      )}

      <div className="bg-card border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-right px-4 py-3 font-medium">الشركة</th>
              <th className="text-right px-4 py-3 font-medium">الاشتراك</th>
              <th className="text-right px-4 py-3 font-medium">الخطة</th>
              <th className="text-right px-4 py-3 font-medium">انتهاء</th>
              <th className="text-right px-4 py-3 font-medium">تاريخ الإنشاء</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">جاري التحميل...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد شركات</td></tr>
            ) : tenants.map(t => {
              const sub = t.subscriptions?.[0]
              const status = sub?.status || 'expired'
              return (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[status] || status}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize">{sub?.plan || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {sub?.end_date ? new Date(sub.end_date).toLocaleDateString('ar-SA') : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString('ar-SA')}
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
