import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateRentalPrice, selectRule, PricingRule } from '@/lib/rental-pricing'
import { getCompanyId } from '@/lib/tenant'

export async function POST(req: NextRequest) {
  const COMPANY_ID = await getCompanyId()
  const { dress_id, start_date, end_date } = await req.json()
  if (!dress_id || !start_date || !end_date)
    return NextResponse.json({ error: 'dress_id, start_date, end_date required' }, { status: 400 })

  const supabase = createClient()

  const [{ data: dress }, { data: rules }] = await Promise.all([
    supabase.from('dresses').select('rental_price, deposit').eq('id', dress_id).single(),
    supabase.from('rental_pricing_rules').select('*').eq('company_id', COMPANY_ID).eq('active', true),
  ])

  if (!dress) return NextResponse.json({ error: 'dress not found' }, { status: 404 })

  const rule = selectRule(dress_id, start_date, end_date, (rules || []) as PricingRule[])
  const breakdown = calculateRentalPrice({
    startDate: start_date,
    endDate: end_date,
    basePricePerDay: dress.rental_price,
    baseDeposit: dress.deposit,
    rule,
  })

  return NextResponse.json(breakdown)
}
