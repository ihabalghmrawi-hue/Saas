'use client'

import { useState } from 'react'
import { Plus, User, Trash2, Check, X, AlertCircle, Loader2, Shield, Key } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props { staff: any[]; roles: any[]; companyId: string }

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30',
  cashier: 'bg-green-100 text-green-700 dark:bg-green-900/30',
}

export function StaffManagementClient({ staff: initialStaff, roles, companyId }: Props) {
  const [staff, setStaff] = useState(initialStaff)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', pin: '', role_id: roles[0]?.id || '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!form.name || !form.pin || !form.role_id) { setError('أكمل جميع الحقول'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStaff(prev => [...prev, data])
      setShowForm(false)
      setForm({ name: '', pin: '', role_id: roles[0]?.id || '' })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل تريد إلغاء تفعيل ${name}؟`)) return
    await fetch('/api/admin/staff', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setStaff(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            إدارة الموظفين
          </h1>
          <p className="text-sm text-muted-foreground">{staff.length} موظف نشط</p>
        </div>
        <button onClick={() => { setShowForm(true); setError('') }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          موظف جديد
        </button>
      </div>

      {/* Roles summary */}
      <div className="grid grid-cols-3 gap-3">
        {roles.map(role => (
          <div key={role.id} className="bg-card border rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[role.name] || 'bg-gray-100 text-gray-700')}>
                {role.name_ar}
              </span>
              <span className="text-xs text-muted-foreground">{staff.filter(s => s.role_id === role.id).length} موظف</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(role.role_permissions || []).length} صلاحية
            </p>
          </div>
        ))}
      </div>

      {/* Staff List */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        {staff.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <User className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">لا يوجد موظفون</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الاسم</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الدور</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الرقم السري</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">آخر دخول</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map(s => {
                const role = s.staff_roles as any
                return (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                        {s.name[0]}
                      </div>
                      {s.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[role?.name] || 'bg-gray-100 text-gray-700')}>
                        {role?.name_ar || role?.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Key className="w-3 h-3" />
                        ••••
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {s.last_login ? formatDate(s.last_login) : 'لم يدخل بعد'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(s.id, s.name)} className="p-1.5 hover:bg-red-100 rounded-lg text-muted-foreground hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Staff Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">إضافة موظف</h3>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">الاسم *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم الموظف" className="w-full border border-input rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background" autoFocus />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">الدور *</label>
              <select value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))} className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none">
                {roles.map(r => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block flex items-center gap-1">
                <Key className="w-3.5 h-3.5" />
                الرقم السري * (4-6 أرقام)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={form.pin}
                onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                placeholder="••••"
                className="w-full border border-input rounded-xl px-3 py-2.5 text-sm text-center font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs p-2.5 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={loading} className="flex-1 bg-primary text-white py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                إضافة
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-input rounded-xl text-sm hover:bg-accent">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
