import { createClient } from '@/lib/supabase/server'
import { StaffManagementClient } from './staff-client'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCompanyId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function StaffPage() {
  const COMPANY_ID = getCompanyId()
  const h = headers()
  const dec  = (v: string | null, fb = '') => { try { return decodeURIComponent(v || fb) } catch { return v || fb } }
  const role = dec(h.get('x-staff-role'))
  const perms = dec(h.get('x-staff-permissions')).split(',').filter(Boolean)

  const isAdminOrOwner = role === 'admin' || role === 'owner'
  const hasStaffPerm   = perms.includes('*') || perms.includes('admin.staff')
  if (!isAdminOrOwner && !hasStaffPerm) {
    redirect('/dashboard')
  }

  const supabase = createClient()

  // Flat query — no joins to avoid schema cache issues
  const { data: staffUsers } = await supabase
    .from('staff_users')
    .select('id, name, is_active, role_id, created_at, last_login')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .order('created_at')

  // Fetch roles separately with permissions JSONB fallback
  const roleIds = [...new Set((staffUsers || []).map(s => s.role_id).filter(Boolean))] as string[]
  const roleMap: Record<string, any> = {}

  if (roleIds.length > 0) {
    const { data: roles, error: rolesErr } = await supabase
      .from('staff_roles')
      .select('id, name, name_ar, permissions')
      .in('id', roleIds)

    if (!rolesErr && roles) {
      for (const r of roles) {
        roleMap[r.id] = { name: r.name, name_ar: r.name_ar, permissions: Array.isArray(r.permissions) ? r.permissions : [] }
      }
    } else {
      // permissions column missing — fetch without it
      const { data: rolesBasic } = await supabase
        .from('staff_roles')
        .select('id, name, name_ar')
        .in('id', roleIds)
      for (const r of (rolesBasic || [])) {
        roleMap[r.id] = { name: r.name, name_ar: r.name_ar, permissions: [] }
      }
    }
  }

  const staff = (staffUsers || []).map(s => ({
    ...s,
    staff_roles: s.role_id ? (roleMap[s.role_id] ?? null) : null,
  }))

  return <StaffManagementClient staff={staff} companyId={COMPANY_ID} />
}
