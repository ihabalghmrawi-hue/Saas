import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/topbar'

const defaultCompany = {
  id: 'default',
  name: 'شركتي',
  name_ar: 'شركتي',
  slug: 'default',
  currency: 'SAR',
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar company={defaultCompany as any} user={null} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar company={defaultCompany} user={null} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
