'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Users, Building2, User, Loader2, Trash2, Pencil, Phone, Mail } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Party } from '@/types/database'

interface PartiesClientProps {
  parties: Party[]
  companyId: string
  currency: string
}

const typeConfig = {
  customer: { label: 'عميل', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30', icon: User },
  supplier: { label: 'مورد', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30', icon: Building2 },
  employee: { label: 'موظف', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30', icon: User },
  other: { label: 'أخرى', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30', icon: Users },
}

export function PartiesClient({ parties, companyId, currency }: PartiesClientProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [form, setForm] = useState({
    name: '', name_ar: '', type: 'customer' as Party['type'],
    email: '', phone: '', address: '', notes: ''
  })

  const filtered = filterType === 'all' ? parties : parties.filter(p => p.type === filterType)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.from('parties').insert({
      company_id: companyId,
      name: form.name || form.name_ar,
      name_ar: form.name_ar || null,
      type: form.type,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
    })
    setForm({ name: '', name_ar: '', type: 'customer', email: '', phone: '', address: '', notes: '' })
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا الطرف؟')) return
    const supabase = createClient()
    await supabase.from('parties').update({ is_active: false }).eq('id', id)
    router.refresh()
  }

  const stats = {
    total: parties.length,
    customers: parties.filter(p => p.type === 'customer').length,
    suppliers: parties.filter(p => p.type === 'supplier').length,
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">الأطراف</h2>
          <p className="text-sm text-muted-foreground">العملاء والموردون والموظفون</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />إضافة طرف
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'إجمالي الأطراف', value: stats.total, color: 'text-foreground' },
          { label: 'العملاء', value: stats.customers, color: 'text-blue-600' },
          { label: 'الموردون', value: stats.suppliers, color: 'text-orange-600' },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-xl border p-4 shadow-sm text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <h3 className="font-semibold text-foreground mb-4">إضافة طرف جديد</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">الاسم (عربي) <span className="text-red-500">*</span></label>
                <input value={form.name_ar} onChange={e => setForm({...form, name_ar: e.target.value})}
                  placeholder="اسم الطرف" required
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="form-label">Name (English)</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="Party Name"
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" dir="ltr" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label">النوع</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value as any})}
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="customer">عميل</option>
                  <option value="supplier">مورد</option>
                  <option value="employee">موظف</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <label className="form-label">البريد الإلكتروني</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  placeholder="email@example.com"
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" dir="ltr" />
              </div>
              <div>
                <label className="form-label">الهاتف</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  placeholder="+966XXXXXXXXX"
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" dir="ltr" />
              </div>
            </div>

            <div>
              <label className="form-label">ملاحظات</label>
              <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                placeholder="ملاحظات اختيارية..."
                className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border border-input bg-background rounded-lg py-2.5 text-sm font-medium hover:bg-accent transition-colors">إلغاء</button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />جاري الحفظ...</> : 'حفظ'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {[{ key: 'all', label: 'الكل' }, { key: 'customer', label: 'العملاء' }, { key: 'supplier', label: 'الموردون' }, { key: 'employee', label: 'الموظفون' }].map(f => (
          <button key={f.key} onClick={() => setFilterType(f.key)}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              filterType === f.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Parties Grid */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center shadow-sm">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-foreground font-medium">لا توجد أطراف</p>
          <p className="text-sm text-muted-foreground">ابدأ بإضافة عملائك وموردينك</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(party => {
            const config = typeConfig[party.type] || typeConfig.other
            const Icon = config.icon
            return (
              <div key={party.id} className="bg-card rounded-xl border p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', config.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{party.name_ar || party.name}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', config.color)}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(party.id)}
                      className="p-1.5 hover:bg-red-50 rounded-md text-muted-foreground hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 mt-3">
                  {party.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span dir="ltr" className="truncate">{party.email}</span>
                    </div>
                  )}
                  {party.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span dir="ltr">{party.phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t flex justify-between">
                  <span className="text-xs text-muted-foreground">الرصيد</span>
                  <span className={cn('text-sm font-semibold', Number(party.current_balance) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {formatCurrency(party.current_balance, currency)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
