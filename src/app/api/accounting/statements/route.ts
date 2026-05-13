import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'
import {
  generateIncomeStatement,
  generateBalanceSheet,
  generateTrialBalance,
  generateCashFlow,
} from '@/lib/accounting/index'

export async function GET(req: NextRequest) {
  const supabase   = createClient()
  const company_id = req.headers.get('x-tenant-id') || await getCompanyId()
  const { searchParams } = req.nextUrl

  const type      = searchParams.get('type') || 'income'
  const date_from = searchParams.get('date_from') || ''
  const date_to   = searchParams.get('date_to')   || ''
  const as_of     = searchParams.get('as_of')     || new Date().toISOString().slice(0, 10)

  // Defaults: current month
  const now        = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today      = now.toISOString().slice(0, 10)

  try {
    if (type === 'income') {
      const from = date_from || monthStart
      const to   = date_to   || today
      const data = await generateIncomeStatement(supabase, company_id, from, to)
      return NextResponse.json(data)
    }

    if (type === 'balance') {
      const data = await generateBalanceSheet(supabase, company_id, as_of || today)
      return NextResponse.json(data)
    }

    if (type === 'trial') {
      const from = date_from || undefined
      const to   = date_to   || today
      const data = await generateTrialBalance(supabase, company_id, from, to)
      return NextResponse.json(data)
    }

    if (type === 'cashflow') {
      const from = date_from || monthStart
      const to   = date_to   || today
      const data = await generateCashFlow(supabase, company_id, from, to)
      return NextResponse.json(data)
    }

    return NextResponse.json(
      { error: 'نوع القائمة غير معروف. استخدم: income | balance | trial | cashflow' },
      { status: 400 },
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
