'use client'

import { useState } from 'react'
import { Plus, User, Trash2, Check, X, AlertCircle, Loader2, Shield, Key, Edit, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface StaffMember {
  id: string
  name: string
  last_login?: string | null
  staff_roles?: { name: string; name_ar: string; permissions?: string[] } | null
}

interface Props { staff: StaffMember[]; companyId: string }

// ── Predefined role templates ──────────────────────────────────────────────────
const ROLE_TEMPLATES = [
  {
    key: 'cashier',
    name_ar: 'كاشير',
    color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30',
    selected: 'bg-green-600 text-white border-green-600',
    defaultPerms: ['pos.access', 'customers.view', 'customers.payment'],
  },
  {
    key: 'accountant',
    name_ar: 'محاسب',
    color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30',
    selected: 'bg-blue-600 text-white border-blue-600',
    defaultPerms: ['expenses.view', 'expenses.create', 'reports.view', 'purchases.view', 'customers.view', 'customers.edit', 'customers.payment'],
  },
  {
    key: 'warehouse_manager',
    name_ar: 'أمين مخزن',
    color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30',
    selected: 'bg-orange-600 text-white border-orange-600',
    defaultPerms: ['inventory.view', 'inventory.edit', 'purchases.view', 'purchases.create'],
  },
  {
    key: 'sales',
    name_ar: 'موظف مبيعات',
    color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30',
    selected: 'bg-purple-600 text-white border-purple-600',
    defaultPerms: ['pos.access', 'pos.discount', 'returns.view', 'returns.create', 'customers.view', 'customers.edit', 'customers.payment'],
  },
  {
    key: 'viewer',
    name_ar: 'مشاهد',
    color: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/50',
    selected: 'bg-gray-600 text-white border-gray-600',
    defaultPerms: ['reports.view', 'inventory.view', 'expenses.view', 'purchases.view', 'customers.view', 'returns.view'],
  },
] as const

// ── All permissions grouped ────────────────────────────────────────────────────
const PERMISSION_GROUPS = [
  {
    label: 'نقطة البيع',
    perms: [
      { code: 'pos.access',     label: 'الوصول لنقطة البيع' },
      { code: 'pos.discount',   label: 'إضافة خصومات' },
      { code: 'pos.cancel_sale',label: 'إلغاء مبيعات' },
    ],
  },
  {
    label: 'المرتجعات',
    perms: [
      { code: 'returns.view',   label: 'عرض المرتجعات' },
      { code: 'returns.create', label: 'إنشاء مرتجع' },
    ],
  },
  {
    label: 'العملاء',
    perms: [
      { code: 'customers.view',    label: 'عرض العملاء' },
      { code: 'customers.edit',    label: 'تعديل العملاء' },
      { code: 'customers.payment', label: 'تحصيل مدفوعات' },
    ],
  },
  {
    label: 'المخزون',
    perms: [
      { code: 'inventory.view', label: 'عرض المخزون' },
      { code: 'inventory.edit', label: 'تعديل المخزون' },
    ],
  },
  {
    label: 'المشتريات',
    perms: [
      { code: 'purchases.view',   label: 'عرض المشتريات' },
      { code: 'purchases.create', label: 'إنشاء مشتريات' },
    ],
  },
  {
    label: 'المالية والتقارير',
    perms: [
      { code: 'expenses.view',   label: 'عرض المصروفات' },
      { code: 'expenses.create', label: 'إضافة مصروفات' },
      { code: 'reports.view',    label: 'عرض التقارير' },
    ],
  },
  {
    label: 'الإدارة',
    perms: [
      { code: 'shifts.manage',   label: 'إدارة الورديات' },
      { code: 'admin.staff',     label: 'إدارة الموظفين' },
      { code: 'admin.audit',     label: 'سجل الأحداث' },
      { code: 'admin.settings',  label: 'الإعدادات' },
    ],
  },
]

const ROLE_COLORS: Record<string, string> = {
  cashier:           'bg-green-100 text-green-700 dark:bg-green-900/30',
  accountant:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30',
  warehouse_manager: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30',
  sales:             'bg-purple-100 text-purple-700 dark:bg-purple-900/30',
  viewer:            'bg-gray-100 text-gray-700 dark:bg-gray-800/50',
  admin:             'bg-red-100 text-red-700 dark:bg-red-900/30',
}

function getRoleColor(roleName?: string): string {
  if (!roleName) return 'bg-gray-100 text-gray-700'
  for (const key of Object.keys(ROLE_COLORS)) {
    if (roleName.startsWith(key)) return ROLE_COLORS[key]
  }
  return 'bg-gray-100 text-gray-700'
}

const emptyForm = {
  name: '',
  pin: '',
  roleKey: 'cashier' as string,
  roleNameAr: 'كاشير',
  permissions: ['pos.access', 'customers.view', 'customers.payment'] as string[],
  showPerms: false,
}

export function StaffManagementClient({ staff: initialStaff, companyId }: Props) {
  const [staff, setStaff]       = useState(initialStaff)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null)
  const [form, setForm]         = useState(emptyForm)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const selectTemplate = (tpl: typeof ROLE_TEMPLATES[number]) => {
    setForm(f => ({ ...f, roleKey: tpl.key, roleNameAr: tpl.name_ar, permissions: [...tpl.defaultPerms] }))
  }

  const togglePerm = (code: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(code)
        ? f.permissions.filter(p => p !== code)
        : [...f.permissions, code],
    }))
  }

  const openNew = () => {
    setForm(emptyForm)
    setEditTarget(null)
    setShowForm(true)
    setError('')
  }

  const openEdit = (s: StaffMember) => {
    const role = s.staff_roles
    const perms = role?.permissions || []
    const tpl = ROLE_TEMPLATES.find(t => role?.name?.startsWith(t.key)) || ROLE_TEMPLATES[0]
    setForm({
      name: s.name,
      pin: '',
      roleKey: tpl.key,
      roleNameAr: role?.name_ar || tpl.name_ar,
      permissions: perms,
      showPerms: true,
    })
    setEditTarget(s)
    setShowForm(true)
    setError('')
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('اسم الموظف مطلوب'); return }
    if (!editTarget && (!form.pin || !/^\d{4,6}$/.test(form.pin))) {
      setError('الرقم السري يجب أن يكون 4-6 أرقام'); return
    }
    setLoading(true); setError('')

    try {
      const method = editTarget ? 'PATCH' : 'POST'
      const body = editTarget
        ? { id: editTarget.id, name: form.name, pin: form.pin || undefined, permissions: form.permissions, role_name_ar: form.roleNameAr }
        : { name: form.name, pin: form.pin, role_name: form.roleKey, role_name_ar: form.roleNameAr, permissions: form.permissions }

      const res  = await fetch('/api/admin/staff', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (editTarget) {
        setStaff(prev => prev.map(s => s.id === editTarget.id ? { ...s, ...data } : s))
      } else {
        setStaff(prev => [...prev, data])
      }
      setShowForm(false)
      setForm(emptyForm)
      setEditTarget(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل تريد إلغاء تفعيل ${name}؟`)) return
    const res = await fetch('/api/admin/staff', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) setStaff(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            إدارة الموظفين
          </h1>
          <p className="text-sm text-muted-foreground">{staff.length} موظف نشط</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          موظف جديد
        </button>
      </div>

      {/* Role Templates Info */}
      <div className="grid grid-cols-5 gap-2">
        {ROLE_TEMPLATES.map(tpl => {
          const count = staff.filter(s => s.staff_roles?.name?.startsWith(tpl.key)).length
          return (
            <div key={tpl.key} className={cn('rounded-xl p-3 border text-center', tpl.color)}>
              <p className="text-xs font-semibold">{tpl.name_ar}</p>
              <p className="text-lg font-bold mt-0.5">{count}</p>
            </div>
          )
        })}
      </div>

      {/* Staff List */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        {staff.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <User className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">لا يوجد موظفون — أضف موظفاً للبدء</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الاسم</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الدور</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الصلاحيات</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">آخر دخول</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map(s => {
                const role  = s.staff_roles
                const perms = role?.permissions || []
                return (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {s.name[0]}
                        </div>
                        {s.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getRoleColor(role?.name))}>
                        {role?.name_ar || role?.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {perms.slice(0, 3).map(p => (
                          <span key={p} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{p}</span>
                        ))}
                        {perms.length > 3 && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">+{perms.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {s.last_login ? formatDate(s.last_login) : 'لم يدخل بعد'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(s.id, s.name)} className="p-1.5 hover:bg-red-100 rounded-lg text-muted-foreground hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg my-4 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-lg">{editTarget ? 'تعديل موظف' : 'إضافة موظف جديد'}</h3>
              <button onClick={() => { setShowForm(false); setEditTarget(null) }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Name */}
              <div>
                <label className="text-sm font-medium mb-1 block">الاسم *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="اسم الموظف"
                  autoFocus
                  className="w-full border border-input rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                />
              </div>

              {/* PIN */}
              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5" />
                  الرقم السري {editTarget ? '(اتركه فارغاً للإبقاء على الحالي)' : '*'} (4-6 أرقام)
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

              {/* Role Templates */}
              <div>
                <label className="text-sm font-medium mb-2 block">الدور الوظيفي *</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {ROLE_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => selectTemplate(tpl)}
                      className={cn(
                        'border rounded-xl p-2.5 text-xs font-medium text-center transition-all',
                        form.roleKey === tpl.key ? tpl.selected : tpl.color
                      )}
                    >
                      {tpl.name_ar}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permissions */}
              <div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, showPerms: !f.showPerms }))}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline mb-2"
                >
                  {form.showPerms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  تخصيص الصلاحيات ({form.permissions.length} صلاحية مفعّلة)
                </button>

                {form.showPerms && (
                  <div className="border border-input rounded-xl p-4 space-y-4 bg-muted/20">
                    {PERMISSION_GROUPS.map(group => (
                      <div key={group.label}>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">{group.label}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {group.perms.map(perm => (
                            <label key={perm.code} className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={form.permissions.includes(perm.code)}
                                onChange={() => togglePerm(perm.code)}
                                className="w-3.5 h-3.5 accent-primary rounded"
                              />
                              <span className="text-xs">{perm.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs p-2.5 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-primary text-white py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editTarget ? 'حفظ التغييرات' : 'إضافة الموظف'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditTarget(null) }}
                  className="px-4 py-2.5 border border-input rounded-xl text-sm hover:bg-accent"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
