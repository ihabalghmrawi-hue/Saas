import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AccountingDomain } from '@/domains/accounting'
import { InventoryDomain } from '@/domains/inventory'
import { SalesDomain } from '@/domains/sales'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ADMIN_COMPANY_ID = '00000000-0000-0000-0000-000000000000'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET || 'local-dev-cron-secret'}`

  if (authHeader !== expected && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const task = req.nextUrl.searchParams.get('task') || 'all'
  const results: Record<string, any> = {}

  try {
    const accounting = new AccountingDomain(supabase, ADMIN_COMPANY_ID)
    const inventory = new InventoryDomain(supabase, ADMIN_COMPANY_ID)
    const sales = new SalesDomain(supabase, ADMIN_COMPANY_ID)

    // Process all companies
    const { data: companies } = await supabase.from('companies').select('id')

    if (task === 'recurring' || task === 'all') {
      const recurringResults: any[] = []
      for (const company of companies || []) {
        const acc = new AccountingDomain(supabase, company.id)
        const result = await acc.workers.recurringJournal.processDueJournals()
        recurringResults.push({ company_id: company.id, ...result })
      }
      results.recurring = recurringResults
    }

    if (task === 'reconciliation' || task === 'all') {
      const reconResults: any[] = []
      for (const company of companies || []) {
        const acc = new AccountingDomain(supabase, company.id)
        await acc.engine.reconciliation.autoMatch('all')
        reconResults.push({ company_id: company.id, ok: true })
      }
      results.reconciliation = reconResults
    }

    if (task === 'integrity' || task === 'all') {
      const integrityResults: any[] = []
      for (const company of companies || []) {
        const acc = new AccountingDomain(supabase, company.id)
        const inv = new InventoryDomain(supabase, company.id)
        const sal = new SalesDomain(supabase, company.id)
        const accResult = await acc.services.integrity.runAllChecks()
        const invResult = await inv.services.integrity.runAllChecks()
        const salResult = await sal.services.integrity.runAllChecks()
        integrityResults.push({
          company_id: company.id,
          accounting: accResult.ok ? accResult.data : accResult.error,
          inventory: invResult.ok ? invResult.data : invResult.error,
          sales: salResult.ok ? salResult.data : salResult.error,
        })
      }
      results.integrity = integrityResults
    }

    if (task === 'inventory' || task === 'all') {
      const invResults: any[] = []
      for (const company of companies || []) {
        const inv = new InventoryDomain(supabase, company.id)
        await inv.workers.inventory.runDailyTasks()
        invResults.push({ company_id: company.id, ok: true })
      }
      results.inventory = invResults
    }

    if (task === 'sales' || task === 'all') {
      const salesResults: any[] = []
      for (const company of companies || []) {
        const sal = new SalesDomain(supabase, company.id)
        const result = await sal.workers.sales.runDailyTasks()
        salesResults.push({ company_id: company.id, ...result })
      }
      results.sales = salesResults
    }

    if (task === 'queue' || task === 'all') {
      const result = await accounting.workers.queue.processAll(20)
      results.queue = result
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
