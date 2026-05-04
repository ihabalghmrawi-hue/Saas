import { SettingsClient } from './settings-client'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

const defaultCompany = {
  id: process.env.NEXT_PUBLIC_COMPANY_ID || 'default',
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

export default function SettingsPage() {
  const businessType = headers().get('x-business-type') || 'retail'
  return (
    <SettingsClient
      company={defaultCompany as any}
      user={null as any}
      role="owner"
      currentBusinessType={businessType}
    />
  )
}
