'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Save } from 'lucide-react'

interface Role       { id: string; name: string; label: string; is_system: boolean }
interface Permission { id: string; key: string; label: string; group_name: string }
interface RolePerm   { role_id: string; permission_id: string }

export default function RolesPage() {
  const [roles, setRoles]         = useState<Role[]>([])
  const [permissions, setPerms]   = useState<Permission[]>([])
  const [rolePerms, setRolePerms] = useState<RolePerm[]>([])
  const [selected, setSelected]   = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [changed, setChanged]     = useState<Record<string, boolean>>({})

  const load = () => {
    fetch('/api/admin/roles').then(r => r.json()).then(d => {
      setRoles(d.roles ?? [])
      setPerms(d.permissions ?? [])
      setRolePerms(d.rolePerms ?? [])
    })
  }

  useEffect(load, [])

  const roleHasPerm = (roleId: string, permId: string) =>
    rolePerms.some(rp => rp.role_id === roleId && rp.permission_id === permId)

  const localHasPerm = (permId: string) => {
    if (!selected) return false
    if (changed[permId] !== undefined) return changed[permId]
    return roleHasPerm(selected, permId)
  }

  const togglePerm = (permId: string) => {
    setChanged(c => ({ ...c, [permId]: !localHasPerm(permId) }))
  }

  const savePermissions = async () => {
    if (!selected) return
    setSaving(true)
    const allPerms = permissions.map(p => p.id)
    const newPerms = allPerms.filter(pid => localHasPerm(pid))
    await fetch('/api/admin/roles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: selected, permission_ids: newPerms }),
    })
    setSaving(false)
    setChanged({})
    load()
  }

  const groups = [...new Set(permissions.map(p => p.group_name))]
  const selectedRole = roles.find(r => r.id === selected)

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" /> الأدوار والصلاحيات
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">اختر دوراً لتعديل صلاحياته</p>
      </div>

      <div className="flex gap-4">
        {/* Roles list */}
        <div className="w-48 space-y-1 shrink-0">
          {roles.map(r => (
            <button
              key={r.id}
              onClick={() => { setSelected(r.id); setChanged({}) }}
              className={`w-full text-right px-3 py-2.5 rounded-xl text-sm transition-colors ${
                selected === r.id
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {r.label || r.name}
              {r.is_system && <span className="block text-[10px] opacity-60">نظام</span>}
            </button>
          ))}
        </div>

        {/* Permissions editor */}
        {selected ? (
          <div className="flex-1 bg-card border rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                صلاحيات: {selectedRole?.label || selectedRole?.name}
              </h2>
              {Object.keys(changed).length > 0 && (
                <button
                  onClick={savePermissions}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              )}
            </div>

            {groups.map(group => (
              <div key={group}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group}</p>
                <div className="grid grid-cols-2 gap-2">
                  {permissions.filter(p => p.group_name === group).map(perm => (
                    <label key={perm.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={localHasPerm(perm.id)}
                        onChange={() => togglePerm(perm.id)}
                        className="w-4 h-4 accent-primary"
                      />
                      <div>
                        <p className="text-sm">{perm.label}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{perm.key}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 bg-card border rounded-2xl p-12 text-center text-muted-foreground">
            اختر دوراً من القائمة لعرض صلاحياته
          </div>
        )}
      </div>
    </div>
  )
}
