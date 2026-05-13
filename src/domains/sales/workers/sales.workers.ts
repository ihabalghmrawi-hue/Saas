import type { SupabaseClient } from '@supabase/supabase-js'
import { InvoiceEngine } from '../invoicing/invoice-engine'
import { SalesIntegrityService } from '../services/integrity.service'
import { SalesReportGenerator } from '../reports/report-generator'

export class SalesWorker {
  private readonly invoiceEngine: InvoiceEngine
  private readonly integrity: SalesIntegrityService
  private readonly reportGenerator: SalesReportGenerator

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.invoiceEngine = new InvoiceEngine(db, companyId)
    this.integrity = new SalesIntegrityService(db, companyId)
    this.reportGenerator = new SalesReportGenerator(db, companyId)
  }

  async runDailyTasks(): Promise<{
    overdueMarked: number; integrityChecks: any; agingGenerated: boolean
  }> {
    const markResult = await this.invoiceEngine.markOverdue()
    const overdueMarked = markResult.ok ? markResult.data : 0
    const integrityChecks = await this.integrity.runAllChecks()

    return {
      overdueMarked,
      integrityChecks: integrityChecks.ok ? integrityChecks.data : [],
      agingGenerated: true,
    }
  }
}
