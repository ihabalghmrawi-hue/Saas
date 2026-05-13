import { SettingsClient } from './settings-client'
import { headers } from 'next/headers'
import { getBranding } from '@/lib/branding'
import { getCompanyId } from '@/lib/tenant'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const COMPANY_ID   = await getCompanyId()
  const h            = await headers()
  const dec          = (v: string | null, fb = '') => { try { return decodeURIComponent(v || fb) } catch { return v || fb } }
  const businessType = dec(h.get('x-business-type'), 'retail')
  const staffRole    = dec(h.get('x-staff-role'),    'owner')

  let companyData: any = null
  let branding: any    = null

  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('companies')
      .select('id, name, name_ar, email, phone, address, tax_number, currency, language, timezone, fiscal_year_start, is_active, created_at, updated_at, logo_url, settings')
      .eq('id', COMPANY_ID)
      .maybeSingle()
    companyData = data
  } catch { /* fallback */ }

  try { branding = await getBranding() } catch { /* fallback */ }

  const company = {
    id:                COMPANY_ID,
    name:              companyData?.name              || '',
    name_ar:           companyData?.name_ar           || companyData?.name || '',
    slug:              'default',
    currency:          companyData?.currency          || 'SAR',
    language:          companyData?.language          || 'ar',
    timezone:          companyData?.timezone          || 'Asia/Riyadh',
    fiscal_year_start: companyData?.fiscal_year_start || 1,
    is_active:         companyData?.is_active         ?? true,
    created_at:        companyData?.created_at        || new Date().toISOString(),
    updated_at:        companyData?.updated_at        || new Date().toISOString(),
    logo_url:          companyData?.logo_url          || null,
    address:           companyData?.address           || null,
    phone:             companyData?.phone             || null,
    email:             companyData?.email             || null,
    tax_number:        companyData?.tax_number        || null,
    settings:          companyData?.settings          || null,
  }

  return (
    <SettingsClient
      company={company as any}
      user={null as any}
      role={staffRole}
      currentBusinessType={businessType}
      branding={branding}
    />
  )
}
