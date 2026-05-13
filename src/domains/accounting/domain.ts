import type { SupabaseClient } from '@supabase/supabase-js'
import { ChartOfAccountsService } from './services/chart-of-accounts.service'
import { JournalService } from './services/journal.service'
import { JournalEngine } from './services/journal-engine.service'
import { PeriodService } from './services/period.service'
import { PostingService } from './services/posting.service'
import { ReconciliationService } from './services/reconciliation.service'
import { IntegrityService } from './services/integrity.service'
import { PostingEngine } from './posting/posting-engine-2'
import { AutoPoster } from './posting/auto-poster'
import { AccountResolver } from './posting/account-resolver'
import { LedgerEngine } from './ledger/ledger-engine'
import { ReconciliationEngine } from './reconciliation/reconciliation-engine-2'
import { JournalWorkflow } from './workflows/journal-workflow'
import { ClosingWorkflow } from './workflows/closing-workflow'
import { RecurringJournalWorker, IntegrityWorker, FiscalClosingWorker, QueueWorker } from './workers'
import { StatementGenerator } from './reports/statement-generator'
import { AccountingEventBus, NotificationService, JobQueueService } from './events'
import { registerDefaultHandlers } from './events/event-handlers'
import { AccountRepository } from './repositories/account.repository'
import { JournalRepository } from './repositories/journal.repository'
import { PeriodRepository } from './repositories/period.repository'
import { PostingRuleRepository, AccountMappingRepository } from './repositories/posting-rule.repository'
import { ReconciliationRepository } from './repositories/reconciliation.repository'
import { RecurringJournalRepository, IntegrityCheckRepository } from './repositories/recurring.repository'

export class AccountingDomain {
  private _cleanupHandlers: (() => void) | null = null

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  get services() {
    return {
      chartOfAccounts: new ChartOfAccountsService(this.db, this.companyId),
      journal: new JournalService(this.db, this.companyId),
      journalEngine: new JournalEngine(this.db, this.companyId),
      period: new PeriodService(this.db, this.companyId),
      posting: new PostingService(this.db, this.companyId),
      reconciliation: new ReconciliationService(this.db, this.companyId),
      integrity: new IntegrityService(this.db, this.companyId),
    }
  }

  get repositories() {
    return {
      account: new AccountRepository(this.db, this.companyId),
      journal: new JournalRepository(this.db, this.companyId),
      period: new PeriodRepository(this.db, this.companyId),
      postingRule: new PostingRuleRepository(this.db, this.companyId),
      accountMapping: new AccountMappingRepository(this.db, this.companyId),
      reconciliation: new ReconciliationRepository(this.db, this.companyId),
      recurring: new RecurringJournalRepository(this.db, this.companyId),
      integrity: new IntegrityCheckRepository(this.db, this.companyId),
    }
  }

  get engine() {
    return {
      posting: new PostingEngine(this.db, this.companyId),
      autoPoster: new AutoPoster(this.db, this.companyId),
      accountResolver: new AccountResolver(this.db, this.companyId),
      reconciliation: new ReconciliationEngine(this.db, this.companyId),
      ledger: new LedgerEngine(this.db, this.companyId),
    }
  }

  get workflows() {
    return {
      journal: new JournalWorkflow(this.db, this.companyId),
      closing: new ClosingWorkflow(this.db, this.companyId),
    }
  }

  get workers() {
    return {
      recurringJournal: new RecurringJournalWorker(this.db, this.companyId),
      integrity: new IntegrityWorker(this.db, this.companyId),
      fiscalClosing: new FiscalClosingWorker(this.db, this.companyId),
      queue: new QueueWorker(this.db, this.companyId),
    }
  }

  get reports() {
    return {
      statementGenerator: new StatementGenerator(this.db, this.companyId),
    }
  }

  get eventBus() {
    return AccountingEventBus.getInstance()
  }

  get notificationService() {
    return new NotificationService(this.db)
  }

  get jobQueue() {
    return new JobQueueService(this.db)
  }

  initialize(): void {
    this._cleanupHandlers = registerDefaultHandlers(this.db, this.companyId)
  }

  destroy(): void {
    if (this._cleanupHandlers) {
      this._cleanupHandlers()
      this._cleanupHandlers = null
    }
  }
}
