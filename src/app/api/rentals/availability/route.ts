import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const COMPANY_ID = await getCompanyId()
  const start = req.nextUrl.searchParams.get('start')
  const end = req.nextUrl.searchParams.get('end')
  const excludeId = req.nextUrl.searchParams.get('exclude')

  if (!start || !end) return NextResponse.json({ error: 'start and end required' }, { status: 400 })

  const supabase = createClient()

  // Get all dresses
  const { data: dresses } = await supabase.from('dresses')
    .select('id').eq('company_id', COMPANY_ID).neq('status', 'retired')

  // For each dress, check availability
  const results = await Promise.all(
    (dresses || []).map(async d => {
      const { data } = await supabase.rpc('is_dress_available', {
        p_dress_id: d.id,
        p_start: start,
        p_end: end,
        p_exclude_order_id: excludeId || null,
      })
      return { dress_id: d.id, available: !!data }
    })
  )

  return NextResponse.json(results)
}
