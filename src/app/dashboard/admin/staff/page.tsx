import { createClient } from '@/lib/supabase/server'
import { StaffManagementClient } from './staff-client'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export default async function StaffPage() {
  const h = headers()
  const role = h.get('x-staff-role')
  const perms = h.get('x-staff-permissions') || ''

  if (role !== 'admin' && !perms.split(',').includes('admin.staff')) {
    redirect('/dashboard')
  }

  const supabase = createClient()
  const [{ data: staff }, { data: roles }] = await Promise.all([
    supabase.from('staff_users').select('*, staff_roles(name, name_ar)').eq('company_id', COMPANY_ID).eq('is_active', true).order('created_at'),
    supabase.from('staff_roles').select('*, role_permissions(permission_code)').eq('company_id', COMPANY_ID).order('name'),
  ])

  return <StaffManagementClient staff={staff || []} roles={roles || []} companyId={COMPANY_ID} />
}
