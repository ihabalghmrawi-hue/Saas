import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/topbar'
import { QuickActionBar } from '@/components/layout/quick-action-bar'
import { headers } from 'next/headers'
import { getFeatures } from '@/lib/features'
import { getBranding } from '@/lib/branding'

const defaultCompany = {
  id: 'default',
  name: process.env.NEXT_PUBLIC_COMPANY_NAME || 'شركتي',
  name_ar: process.env.NEXT_PUBLIC_COMPANY_NAME || 'شركتي',
  slug: 'default',
  currency: process.env.NEXT_PUBLIC_CURRENCY || 'SAR',
  language: 'ar',
  timezone: 'Asia/Riyadh',
  fiscal_year_start: 1,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  logo_url: null,
  address: null,
  phone: null,
  email: null,
  tax_number: null,
  settings: null,
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const h = headers()
  const staffName = h.get('x-staff-name') || 'المدير'
  const staffRole = h.get('x-staff-role') || 'admin'
  const staffPermissions = (h.get('x-staff-permissions') || '').split(',').filter(Boolean)
  const businessType = h.get('x-business-type') || 'retail'

  const staff = { name: staffName, role: staffRole, permissions: staffPermissions }
  const features = getFeatures(businessType)
  const branding = await getBranding()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar company={defaultCompany as any} user={null} staff={staff} features={features} branding={branding} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar company={defaultCompany} user={null} staff={staff} features={features} />
        <QuickActionBar features={features} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
