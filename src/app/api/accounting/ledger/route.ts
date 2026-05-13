import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'
import { getGeneralLedger, getAccountLedger } from '@/lib/accounting/index'

export async function GET(req: NextRequest) {
  const supabase   = createClient()
  const company_id = req.headers.get('x-tenant-id') || await getCompanyId()
  const { searchParams } = req.nextUrl

  const account_id = searchParams.get('account_id') || undefined
  const date_from  = searchParams.get('date_from')  || undefined
  const date_to    = searchParams.get('date_to')    || undefined
  const period_id  = searchParams.get('period_id')  || undefined

  try {
    if (account_id) {
      const data = await getAccountLedger(supabase, account_id, company_id, date_from, date_to)
      return NextResponse.json(data)
    }

    const data = await getGeneralLedger(supabase, company_id, {
      date_from,
      date_to,
      period_id,
    })

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
