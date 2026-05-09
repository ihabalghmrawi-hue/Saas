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
  const { data: staff } = await supabase
    .from('staff_users')
    .select('*, staff_roles(name, name_ar, role_permissions(permission_code))')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .order('created_at')

  return <StaffManagementClient staff={staff || []} companyId={COMPANY_ID} />
}
