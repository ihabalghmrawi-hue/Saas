import { NextResponse }      from 'next/server'
import { headers }           from 'next/headers'
import { createClient }      from '@/lib/supabase/server'
import { checkAllLimits }    from '@/lib/usage-limits'
import { type Plan }         from '@/lib/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const h         = await headers()
  const companyId = h.get('x-tenant-id')
  const isSuperAdmin = h.get('x-is-super-admin') === 'true'

  if (!companyId || companyId === 'super_admin') {
    return NextResponse.json({ error: 'tenant required' }, { status: 400 })
  }

  const supabase = createClient()

  // Fetch current plan
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status, end_date')
    .eq('company_id', companyId)
    .maybeSingle()

  const plan = (sub?.plan ?? 'free') as Plan

  const usage = await checkAllLimits(supabase as any, companyId, plan)

  return NextResponse.json({
    plan,
    subscriptionStatus: sub?.status ?? 'expired',
    subscriptionEndDate: sub?.end_date ?? null,
    limits: usage,
  })
}
