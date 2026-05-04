'use client'

import { useState } from 'react'
import {
  Plus, Trash2, Check, X, Loader2, Tag, Package,
  Calendar, Sparkles, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Percent, Banknote
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { calculateRentalPrice } from '@/lib/rental-pricing'
import type { PricingRule, PricingType, DepositType, PackageRule, EventRule } from '@/lib/rental-pricing'

const TYPE_META: Record<PricingType, { label: string; icon: React.ReactNode; desc: string; color: string }> = {
  per_day:  { label: 'يومي',         icon: <Tag className="w-4 h-4" />,      desc: 'سعر ثابت لكل يوم إيجار',                    color: 'bg-blue-50 border-blue-200 text-blue-700' },
  package:  { label: 'باقة',         icon: <Package className="w-4 h-4" />,  desc: 'خصم عند حجز عدة أيام معاً',                  color: 'bg-purple-50 border-purple-200 text-purple-700' },
  weekend:  { label: 'عطلة',         icon: <Calendar className="w-4 h-4" />, desc: 'سعر مختلف أيام الجمعة والسبت',               color: 'bg-amber-50 border-amber-200 text-amber-700' },
  event:    { label: 'مناسبة خاصة', icon: <Sparkles className="w-4 h-4" />, desc: 'سعر خاص لفترة زمنية محددة (مواسم، أعياد)', color: 'bg-pink-50 border-pink-200 text-pink-700' },
}

const EMPTY_RULE: Partial<PricingRule> = {
  name: '', type: 'per_day', base_price: 0,
  deposit_type: 'fixed', deposit_value: 0,
  packages: [], weekend: { days: [5, 6], multiplier: 1.5 },
  events: [], active: true, dress_id: undefined,
}

interface Dress { id: string; name: string; code: string }

export function PricingClient({ rules: init, dresses, currency }: { rules: PricingRule[]; dresses: Dress[]; currency: string }) {
  const [rules, setRules] = useState<PricingRule[]>(init)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PricingRule | null>(null)
  const [form, setForm] = useState<any>(EMPTY_RULE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Simulator
  const [simDays, setSimDays] = useState(3)
  const [simRule, setSimRule] = useState<PricingRule | null>(null)
  const [simBasePrice, setSimBasePrice] = useState(200)

  const openNew = () => { setForm({ ...EMPTY_RULE }); setEditing(null); setError(''); setShowForm(true) }
  const openEdit = (r: PricingRule) => { setForm({ ...r }); setEditing(r); setError(''); setShowForm(true) }

  const f = (key: string, val: any) => setForm((prev: any) => ({ ...prev, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const payload = { ...form, base_price: parseFloat(form.base_price) || 0, deposit_value: parseFloat(form.deposit_value) || 0 }
      const url = editing ? `/api/rentals/pricing/${editing.id}` : '/api/rentals/pricing'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (editing) setRules(prev => prev.map(r => r.id === editing.id ? data : r))
      else setRules(prev => [data, ...prev])
      setShowForm(false)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const toggleActive = async (rule: PricingRule) => {
    const res = await fetch(`/api/rentals/pricing/${rule.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !rule.active }),
    })
    if (res.ok) setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))
  }

  const deleteRule = async (id: string) => {
    if (!confirm('حذف هذه القاعدة؟')) return
    await fetch(`/api/rentals/pricing/${id}`, { method: 'DELETE' })
    setRules(prev => prev.filter(r => r.id !== id))
  }

  // Simulator calc
  const today = new Date().toISOString().slice(0, 10)
  const simEnd = new Date(Date.now() + simDays * 86400000).toISOString().slice(0, 10)
  const simResult = simRule ? calculateRentalPrice({ startDate: today, endDate: simEnd, basePricePerDay: simBasePrice, baseDeposit: simRule.deposit_value, rule: simRule }) : null

  const inp = 'w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20'

  // Package helpers
  const addPackage = () => {
    const pkgs = [...(form.packages || []), { days: 3, price: 0, label: 'باقة 3 أيام' }]
    f('packages', pkgs)
  }
  const updatePackage = (i: number, key: string, val: any) => {
    const pkgs = [...(form.packages || [])]
    pkgs[i] = { ...pkgs[i], [key]: val }
    f('packages', pkgs)
  }
  const removePackage = (i: number) => {
    f('packages', (form.packages || []).filter((_: any, j: number) => j !== i))
  }

  // Event helpers
  const addEvent = () => {
    f('events', [...(form.events || []), { name: '', start_date: '', end_date: '', multiplier: 1.5 }])
  }
  const updateEvent = (i: number, key: string, val: any) => {
    const evs = [...(form.events || [])]
    evs[i] = { ...evs[i], [key]: val }
    f('events', evs)
  }
  const removeEvent = (i: number) => {
    f('events', (form.events || []).filter((_: any, j: number) => j !== i))
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Tag className="w-5 h-5 text-primary" /> قواعد التسعير</h1>
          <p className="text-sm text-muted-foreground">{rules.length} قاعدة · {rules.filter(r => r.active).length} مفعّلة</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> قاعدة جديدة
        </button>
      </div>

      {/* Type cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.entries(TYPE_META) as [PricingType, typeof TYPE_META[PricingType]][]).map(([type, meta]) => (
          <div key={type} className={cn('border rounded-2xl p-4', meta.color)}>
            <div className="flex items-center gap-2 mb-1">{meta.icon}<span className="font-semibold text-sm">{meta.label}</span></div>
            <p className="text-xs opacity-75 leading-snug">{meta.desc}</p>
            <p className="text-xs font-bold mt-2">{rules.filter(r => r.type === type && r.active).length} مفعّل</p>
          </div>
        ))}
      </div>

      {/* Simulator */}
      <div className="bg-card border rounded-2xl p-5">
        <h2 className="font-semibold text-sm mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> محاكي الأسعار</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">القاعدة</label>
            <select className={inp} value={simRule?.id || ''} onChange={e => setSimRule(rules.find(r => r.id === e.target.value) || null)}>
              <option value="">بدون قاعدة (يومي)</option>
              {rules.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">السعر الأساسي / يوم</label>
            <input type="number" className={inp} value={simBasePrice} onChange={e => setSimBasePrice(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">عدد الأيام</label>
            <input type="number" min={1} max={90} className={inp} value={simDays} onChange={e => setSimDays(parseInt(e.target.value) || 1)} />
          </div>
          <div className="flex items-end">
            <div className="w-full bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 text-center">
              <p className="text-xs text-muted-foreground">الإجمالي</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(simResult ? simResult.total : simBasePrice * simDays, currency)}</p>
            </div>
          </div>
        </div>
        {simResult && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">تفصيل الحساب ({simResult.applied_rule})</p>
            {simResult.line_items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm bg-muted/30 px-3 py-1.5 rounded-lg">
                <span className="text-muted-foreground">{item.label}{item.note ? <span className="text-xs mr-1 opacity-60">({item.note})</span> : ''}</span>
                <span className="font-medium">{formatCurrency(item.amount, currency)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm border-t pt-2 font-bold">
              <span>التأمين</span>
              <span className="text-muted-foreground">{formatCurrency(simResult.deposit, currency)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Rules list */}
      <div className="space-y-2">
        {rules.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Tag className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">لا توجد قواعد تسعير — سيُستخدم السعر الافتراضي للفستان</p>
          </div>
        )}
        {rules.map(rule => {
          const meta = TYPE_META[rule.type]
          const expanded = expandedId === rule.id
          const dress = dresses.find(d => d.id === rule.dress_id)
          return (
            <div key={rule.id} className={cn('bg-card border rounded-2xl overflow-hidden transition-all', !rule.active && 'opacity-60')}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center border', meta.color)}>{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{rule.name}</p>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', meta.color)}>{meta.label}</span>
                    {dress && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{dress.name}</span>}
                    {!rule.dress_id && <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">عام</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatCurrency(rule.base_price, currency)}/يوم · تأمين: {rule.deposit_type === 'percentage' ? `${rule.deposit_value}%` : formatCurrency(rule.deposit_value, currency)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleActive(rule)} className="p-1.5 hover:bg-accent rounded-lg" title={rule.active ? 'إلغاء التفعيل' : 'تفعيل'}>
                    {rule.active ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <button onClick={() => openEdit(rule)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground text-xs">تعديل</button>
                  <button onClick={() => deleteRule(rule.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-muted-foreground hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setExpandedId(expanded ? null : rule.id)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground">
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {expanded && (
                <div className="border-t px-4 py-3 bg-muted/20 text-xs space-y-1.5">
                  {rule.type === 'package' && rule.packages?.map((p, i) => (
                    <div key={i} className="flex justify-between bg-card px-3 py-1.5 rounded-lg">
                      <span>{p.label}</span>
                      <span className="font-medium">{p.days} أيام بـ {formatCurrency(p.price, currency)}</span>
                    </div>
                  ))}
                  {rule.type === 'weekend' && rule.weekend && (
                    <div className="bg-card px-3 py-1.5 rounded-lg flex justify-between">
                      <span>مضاعف عطلة الأسبوع</span>
                      <span className="font-medium">×{rule.weekend.multiplier} ({formatCurrency(rule.base_price * rule.weekend.multiplier, currency)}/يوم)</span>
                    </div>
                  )}
                  {rule.type === 'event' && rule.events?.map((e, i) => (
                    <div key={i} className="bg-card px-3 py-1.5 rounded-lg flex justify-between">
                      <span>{e.name} ({e.start_date} ← {e.end_date})</span>
                      <span className="font-medium">×{e.multiplier}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-card z-10">
              <h2 className="font-bold">{editing ? 'تعديل القاعدة' : 'قاعدة تسعير جديدة'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-5">

              {/* Name + type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">اسم القاعدة *</label>
                  <input required value={form.name} onChange={e => f('name', e.target.value)} placeholder="باقة نهاية الأسبوع" className={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">نوع التسعير</label>
                  <select value={form.type} onChange={e => f('type', e.target.value)} className={inp}>
                    {(Object.entries(TYPE_META) as [PricingType, typeof TYPE_META[PricingType]][]).map(([t, m]) => (
                      <option key={t} value={t}>{m.label} — {m.desc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">تطبيق على فستان (اختياري)</label>
                  <select value={form.dress_id || ''} onChange={e => f('dress_id', e.target.value || undefined)} className={inp}>
                    <option value="">كل الفساتين (عام)</option>
                    {dresses.map(d => <option key={d.id} value={d.id}>{d.name} {d.code ? `(${d.code})` : ''}</option>)}
                  </select>
                </div>
              </div>

              {/* Base price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">السعر الأساسي / يوم *</label>
                  <input type="number" step="0.01" required value={form.base_price} onChange={e => f('base_price', e.target.value)} className={inp} />
                </div>
                <div />
              </div>

              {/* Deposit */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">التأمين (الوديعة)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">نوع التأمين</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => f('deposit_type', 'fixed')}
                        className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all', form.deposit_type === 'fixed' ? 'bg-primary text-white border-primary' : 'hover:bg-accent')}>
                        <Banknote className="w-3.5 h-3.5" /> مبلغ ثابت
                      </button>
                      <button type="button" onClick={() => f('deposit_type', 'percentage')}
                        className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all', form.deposit_type === 'percentage' ? 'bg-primary text-white border-primary' : 'hover:bg-accent')}>
                        <Percent className="w-3.5 h-3.5" /> نسبة %
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {form.deposit_type === 'percentage' ? 'النسبة (%)' : 'المبلغ'}
                    </label>
                    <input type="number" step="0.01" value={form.deposit_value} onChange={e => f('deposit_value', e.target.value)} className={inp} />
                  </div>
                </div>
              </div>

              {/* Package rules */}
              {form.type === 'package' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">الباقات</p>
                    <button type="button" onClick={addPackage} className="text-xs text-primary flex items-center gap-1 hover:underline">
                      <Plus className="w-3 h-3" /> إضافة باقة
                    </button>
                  </div>
                  {(form.packages || []).map((pkg: PackageRule, i: number) => (
                    <div key={i} className="grid grid-cols-7 gap-2 items-end bg-muted/30 p-3 rounded-xl">
                      <div className="col-span-3">
                        <label className="text-[10px] text-muted-foreground mb-1 block">اسم الباقة</label>
                        <input value={pkg.label} onChange={e => updatePackage(i, 'label', e.target.value)} placeholder="باقة 3 أيام" className={inp} />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] text-muted-foreground mb-1 block">أيام</label>
                        <input type="number" value={pkg.days} onChange={e => updatePackage(i, 'days', parseInt(e.target.value))} className={inp} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-muted-foreground mb-1 block">السعر الكلي</label>
                        <input type="number" value={pkg.price} onChange={e => updatePackage(i, 'price', parseFloat(e.target.value))} className={inp} />
                      </div>
                      <button type="button" onClick={() => removePackage(i)} className="p-2 text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(form.packages || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">أضف باقات بأسعار خاصة</p>
                  )}
                </div>
              )}

              {/* Weekend rules */}
              {form.type === 'weekend' && (
                <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">إعداد عطلة الأسبوع</p>
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">أيام العطلة</label>
                    <div className="flex gap-2 flex-wrap">
                      {['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'].map((day, idx) => {
                        const selected = (form.weekend?.days || []).includes(idx)
                        return (
                          <button key={idx} type="button"
                            onClick={() => {
                              const days = selected ? (form.weekend?.days || []).filter((d: number) => d !== idx) : [...(form.weekend?.days || []), idx]
                              f('weekend', { ...form.weekend, days })
                            }}
                            className={cn('px-3 py-1.5 rounded-lg text-xs border font-medium transition-all', selected ? 'bg-primary text-white border-primary' : 'hover:bg-accent')}>
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">معامل التضخيم (مثال: 1.5 = +50%)</label>
                    <div className="flex items-center gap-3">
                      <input type="number" step="0.1" min="1" value={form.weekend?.multiplier || 1.5}
                        onChange={e => f('weekend', { ...form.weekend, multiplier: parseFloat(e.target.value) })} className={cn(inp, 'max-w-24')} />
                      {form.base_price > 0 && (
                        <span className="text-xs text-muted-foreground">= {formatCurrency(form.base_price * (form.weekend?.multiplier || 1.5), currency)} / يوم</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Event rules */}
              {form.type === 'event' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">المناسبات الخاصة</p>
                    <button type="button" onClick={addEvent} className="text-xs text-primary flex items-center gap-1 hover:underline">
                      <Plus className="w-3 h-3" /> إضافة مناسبة
                    </button>
                  </div>
                  {(form.events || []).map((ev: EventRule, i: number) => (
                    <div key={i} className="bg-muted/30 p-3 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <input value={ev.name} onChange={e => updateEvent(i, 'name', e.target.value)} placeholder="اسم المناسبة (مثال: موسم الأعراس)" className={cn(inp, 'flex-1')} />
                        <button type="button" onClick={() => removeEvent(i)} className="mr-2 p-1.5 text-red-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-1 block">من</label>
                          <input type="date" value={ev.start_date} onChange={e => updateEvent(i, 'start_date', e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-1 block">إلى</label>
                          <input type="date" value={ev.end_date} onChange={e => updateEvent(i, 'end_date', e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-1 block">المعامل ×</label>
                          <input type="number" step="0.1" min="1" value={ev.multiplier} onChange={e => updateEvent(i, 'multiplier', parseFloat(e.target.value))} className={inp} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(form.events || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">أضف مناسبات بأسعار مضاعفة</p>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={loading}
                  className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editing ? 'حفظ التعديلات' : 'إضافة القاعدة'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 border rounded-xl text-sm hover:bg-accent">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
