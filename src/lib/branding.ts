import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export interface Branding {
  company_id: string
  name: string
  name_ar: string
  phone: string
  address: string
  tax_number: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  secondary_color: string
  receipt_footer: string
  receipt_header: string
}

export const DEFAULT_BRANDING: Branding = {
  company_id: 'default',
  name:    '',
  name_ar: '',
  phone: '',
  address: '',
  tax_number: '',
  logo_url: null,
  favicon_url: null,
  primary_color: '#6366f1',
  secondary_color: '#8b5cf6',
  receipt_footer: 'شكراً لزيارتكم',
  receipt_header: '',
}

export async function getBranding(): Promise<Branding> {
  try {
    const companyId = await getCompanyId()
    const supabase  = createClient()
    const { data } = await supabase
      .from('branding')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()
    return data ? { ...DEFAULT_BRANDING, ...data } : { ...DEFAULT_BRANDING, company_id: companyId }
  } catch {
    return DEFAULT_BRANDING
  }
}

// Convert hex color to HSL values for CSS custom properties
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function buildThemeCss(branding: Branding): string {
  const p = hexToHsl(branding.primary_color || '#6366f1')
  return `
    :root {
      --primary: ${p.h} ${p.s}% ${p.l}%;
      --primary-foreground: 0 0% 100%;
      --ring: ${p.h} ${p.s}% ${p.l}%;
    }
    .dark {
      --primary: ${p.h} ${p.s}% ${Math.min(p.l + 10, 80)}%;
    }
  `.trim()
}
