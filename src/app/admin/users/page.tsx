'use client'

import { useEffect, useState } from 'react'
import { Users, CheckCircle2, XCircle } from 'lucide-react'

interface Membership {
  id: string; role: string; is_active: boolean; created_at: string
  companies: { id: string; name: string } | null
  roles: { id: string; name: string; label: string } | null
}

export default function UsersPage() {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading]         = useState(true)
  const [acting, setActing]           = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/users').then(r => r.json())
      .then(d => { setMemberships(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(load, [])

  const toggle = async (id: string, is_active: boolean) => {
    setActing(id)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membership_id: id, is_active }),
    })
    setActing(null)
    load()
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> إدارة المستخدمين
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{memberships.length} عضوية</p>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-right px-4 py-3 font-medium">الشركة</th>
              <th className="text-right px-4 py-3 font-medium">الدور</th>
              <th className="text-right px-4 py-3 font-medium">الحالة</th>
              <th className="text-right px-4 py-3 font-medium">تاريخ الإنشاء</th>
              <th className="text-right px-4 py-3 font-medium">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">جاري التحميل...</td></tr>
            ) : memberships.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد عضويات</td></tr>
            ) : memberships.map(m => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{m.companies?.name || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {m.roles?.label || m.roles?.name || m.role || '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {m.is_active ? 'نشط' : 'معطل'}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString('ar-SA')}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggle(m.id, !m.is_active)}
                    disabled={acting === m.id}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors ${
                      m.is_active
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    {m.is_active ? <><XCircle className="w-3.5 h-3.5" /> تعطيل</> : <><CheckCircle2 className="w-3.5 h-3.5" /> تفعيل</>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
