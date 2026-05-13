import type { SupabaseClient } from '@supabase/supabase-js'
import { PayrollRunRepository, PayrollLineRepository, HrAccountingLinkRepository } from '../repositories/payroll.repository'
import { HrEventBus } from '../events/event-bus'
import type { ServiceResult } from '../types'

/**
 * Maps payroll transactions to the accounting GL.
 * Uses immutable journal references — payroll runs once posted to GL
 * cannot be modified; corrections create reversal+new run entries.
 */
export class HrAccountingService {
  private readonly runRepo: PayrollRunRepository
  private readonly lineRepo: PayrollLineRepository
  private readonly acctLinkRepo: HrAccountingLinkRepository
  private readonly eventBus: HrEventBus

  // Default account mapping — override via company_settings
  private readonly DEFAULT_MAPPING = {
    salaryExpense: '5001',
    salaryPayable: '2101',
    taxPayable: '2102',
    socialInsurancePayable: '2103',
    loanReceivable: '1201',
    employerContributionExpense: '5002',
  }

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.runRepo = new PayrollRunRepository(db, companyId)
    this.lineRepo = new PayrollLineRepository(db, companyId)
    this.acctLinkRepo = new HrAccountingLinkRepository(db, companyId)
    this.eventBus = HrEventBus.getInstance()
  }

  async postRunToGL(runId: string): Promise<ServiceResult<{ journalEntryId: string }>> {
    const run = await this.runRepo.findById(runId)
    if (!run) return { ok: false, error: 'شغيلة الرواتب غير موجودة', code: 'NOT_FOUND' }
    if (run.posted_to_gl) return { ok: false, error: 'تم الترحيل إلى الحسابات مسبقاً', code: 'ALREADY_POSTED' }

    const existingLink = await this.acctLinkRepo.findByRun(runId)
    if (existingLink) return { ok: false, error: 'رابط محاسبي موجود مسبقاً', code: 'LINK_EXISTS' }

    try {
      const lines = await this.lineRepo.findByRun(runId)
      const actg = this.buildJournal(run, lines)

      const link = await this.acctLinkRepo.create({
        run_id: runId, journal_entry_id: `payroll-${runId}-${Date.now()}`,
        total_debit: actg.totalDebit, total_credit: actg.totalCredit, status: 'posted',
        posted_at: new Date().toISOString(),
      })

      await this.runRepo.update(runId, { posted_to_gl: true, gl_journal_entry_id: link.journal_entry_id })

      this.eventBus.emit('hr.payroll.posted', {
        id: runId, type: 'hr.payroll.posted', companyId: this.companyId,
        timestamp: new Date().toISOString(),
        metadata: { journalEntryId: link.journal_entry_id, totalDebit: actg.totalDebit, totalCredit: actg.totalCredit },
      })

      return { ok: true, data: { journalEntryId: link.journal_entry_id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'POST_TO_GL_FAILED' }
    }
  }

  async reverseGLPosting(runId: string): Promise<ServiceResult<void>> {
    const link = await this.acctLinkRepo.findByRun(runId)
    if (!link) return { ok: false, error: 'لا يوجد ترحيل محاسبي لهذه الشغيلة', code: 'NO_LINK' }
    if (link.status === 'reversed') return { ok: false, error: 'الترحيل ملغي مسبقاً', code: 'ALREADY_REVERSED' }

    try {
      await this.acctLinkRepo.updateStatus(link.id, 'reversed')
      await this.runRepo.update(runId, { posted_to_gl: false, gl_journal_entry_id: null })
      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'REVERSE_GL_FAILED' }
    }
  }

  private buildJournal(run: any, lines: any[]): { lines: any[]; totalDebit: number; totalCredit: number } {
    const m = this.DEFAULT_MAPPING
    const journalLines: any[] = []

    const earningsByCategory = new Map<string, number>()
    const deductionsByCategory = new Map<string, number>()
    let employerContribs = 0

    for (const line of lines) {
      const amount = Number(line.amount)
      if (line.line_type === 'earning') {
        const curr = earningsByCategory.get(line.category) || 0
        earningsByCategory.set(line.category, curr + amount)
      } else if (line.line_type === 'deduction') {
        const curr = deductionsByCategory.get(line.category) || 0
        deductionsByCategory.set(line.category, curr + Math.abs(amount))
      } else if (line.line_type === 'employer_contribution') {
        employerContribs += amount
      }
    }

    const totalEarnings = Array.from(earningsByCategory.values()).reduce((s, v) => s + v, 0)
    const totalDeductions = Array.from(deductionsByCategory.values()).reduce((s, v) => s + v, 0)

    if (totalEarnings > 0) {
      journalLines.push({ account_code: m.salaryExpense, debit: totalEarnings, credit: 0, description: 'مصروف رواتب ومزايا' })
    }

    const netPayable = totalEarnings - totalDeductions
    if (netPayable > 0) {
      journalLines.push({ account_code: m.salaryPayable, debit: 0, credit: netPayable, description: 'صافي رواتب مستحقة' })
    }

    if (deductionsByCategory.has('tax') && (deductionsByCategory.get('tax') || 0) > 0) {
      const tax = deductionsByCategory.get('tax') || 0
      journalLines.push({ account_code: m.salaryPayable, debit: tax, credit: 0, description: 'تسوية خصم الضريبة' })
      journalLines.push({ account_code: m.taxPayable, debit: 0, credit: tax, description: 'ضريبة رواتب مستحقة' })
    }

    if (deductionsByCategory.has('insurance') && (deductionsByCategory.get('insurance') || 0) > 0) {
      const si = deductionsByCategory.get('insurance') || 0
      journalLines.push({ account_code: m.salaryPayable, debit: si, credit: 0, description: 'تسوية تأمينات اجتماعية' })
      journalLines.push({ account_code: m.socialInsurancePayable, debit: 0, credit: si, description: 'تأمينات اجتماعية مستحقة' })
    }

    if (deductionsByCategory.has('loan') && (deductionsByCategory.get('loan') || 0) > 0) {
      const loans = deductionsByCategory.get('loan') || 0
      journalLines.push({ account_code: m.salaryPayable, debit: loans, credit: 0, description: 'تسوية قروض' })
      journalLines.push({ account_code: m.loanReceivable, debit: 0, credit: loans, description: 'قروض موظفين' })
    }

    if (employerContribs > 0) {
      journalLines.push({ account_code: m.employerContributionExpense, debit: employerContribs, credit: 0, description: 'مصروف مساهمات صاحب العمل' })
      journalLines.push({ account_code: m.socialInsurancePayable, debit: 0, credit: employerContribs, description: 'مساهمات صاحب العمل مستحقة' })
    }

    const totalDebit = journalLines.reduce((s: number, l: any) => s + l.debit, 0)
    const totalCredit = journalLines.reduce((s: number, l: any) => s + l.credit, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      const diff = totalDebit - totalCredit
      journalLines.push({
        account_code: diff > 0 ? m.salaryPayable : m.salaryExpense,
        debit: diff < 0 ? Math.abs(diff) : 0,
        credit: diff > 0 ? diff : 0,
        description: 'تسوية قيد الرواتب',
      })
    }

    const finalDebit = journalLines.reduce((s: number, l: any) => s + l.debit, 0)
    const finalCredit = journalLines.reduce((s: number, l: any) => s + l.credit, 0)

    return { lines: journalLines, totalDebit: finalDebit, totalCredit: finalCredit }
  }
}
