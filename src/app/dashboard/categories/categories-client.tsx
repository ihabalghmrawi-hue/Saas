'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Tag, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/types/database'

interface CategoriesClientProps { categories: Category[]; companyId: string }

const iconOptions = ['shopping-cart','briefcase','trending-up','plus-circle','package','users','home','zap','megaphone','car','file-text','more-horizontal','coffee','gift','heart','star','globe','shield','tool','music']
const colorOptions = ['#10B981','#3B82F6','#8B5CF6','#EF4444','#F59E0B','#EC4899','#14B8A6','#F97316','#6366F1','#78716C','#06B6D4','#84CC16']

export function CategoriesClient({ categories, companyId }: CategoriesClientProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState<'all'|'income'|'expense'>('all')
  const [form, setForm] = useState({ name: '', name_ar: '', type: 'expense' as 'income'|'expense', icon: 'tag', color: '#3B82F6' })

  const filtered = filterType === 'all' ? categories : categories.filter(c => c.type === filterType || c.type === 'both')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.from('categories').insert({
      company_id: companyId, name: form.name || form.name_ar, name_ar: form.name_ar || null,
      type: form.type, icon: form.icon, color: form.color,
    })
    setForm({ name: '', name_ar: '', type: 'expense', icon: 'tag', color: '#3B82F6' })
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذه الفئة؟')) return
    const supabase = createClient()
    await supabase.from('categories').update({ is_active: false }).eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">الفئات</h2>
          <p className="text-sm text-muted-foreground">تصنيف المعاملات المالية</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />إضافة فئة
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <h3 className="font-semibold text-foreground mb-4">فئة جديدة</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">الاسم (عربي) *</label>
                <input value={form.name_ar} onChange={e => setForm({...form, name_ar: e.target.value})}
                  placeholder="مثال: المبيعات" required
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="form-label">Name (English)</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="e.g. Sales"
                  className="w-full border border-input bg-background rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" dir="ltr" />
              </div>
            </div>

            <div>
              <label className="form-label">النوع</label>
              <div className="flex gap-2">
                {[{ v: 'income', l: 'دخل' }, { v: 'expense', l: 'مصروف' }, { v: 'both', l: 'كلاهما' }].map(t => (
                  <button key={t.v} type="button" onClick={() => setForm({...form, type: t.v as any})}
                    className={cn('flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                      form.type === t.v ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:border-muted-foreground')}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">اللون</label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map(c => (
                  <button key={c} type="button" onClick={() => setForm({...form, color: c})}
                    className={cn('w-7 h-7 rounded-full transition-all', form.color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-110')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border border-input bg-background rounded-lg py-2.5 text-sm font-medium hover:bg-accent">إلغاء</button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />...</> : 'حفظ'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {[{ k: 'all', l: 'الكل' }, { k: 'income', l: 'الإيرادات' }, { k: 'expense', l: 'المصروفات' }].map(f => (
          <button key={f.k} onClick={() => setFilterType(f.k as any)}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              filterType === f.k ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {f.l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full bg-card rounded-xl border p-12 text-center shadow-sm">
            <Tag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-foreground font-medium">لا توجد فئات</p>
          </div>
        ) : filtered.map(cat => (
          <div key={cat.id} className="bg-card rounded-xl border p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-lg font-bold"
              style={{ backgroundColor: cat.color }}>
              <Tag className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm truncate">{cat.name_ar || cat.name}</p>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium',
                cat.type === 'income' ? 'text-emerald-600 bg-emerald-50' : cat.type === 'expense' ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50')}>
                {cat.type === 'income' ? 'دخل' : cat.type === 'expense' ? 'مصروف' : 'كلاهما'}
              </span>
            </div>
            <button onClick={() => handleDelete(cat.id)}
              className="p-1.5 hover:bg-red-50 rounded-md text-muted-foreground hover:text-red-600 transition-colors shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
