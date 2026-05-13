import { BaseRepository } from './base-repository'
import type { AccountSummary, TransactionEntry, Invoice } from '@/lib/workbench/types'

export class AccountRepository extends BaseRepository<AccountSummary> {
  constructor() {
    super('accounts')
  }

  async getByType(type: string): Promise<{ data: AccountSummary[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('type', type)
        .order('code', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as AccountSummary[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getTree(): Promise<{ data: AccountSummary[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .order('code', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as AccountSummary[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getBalances(periodStart: number, periodEnd: number): Promise<{ data: any[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('account_balances')
        .select('*')
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd)

      if (error) return { data: [], error: error.message }
      return { data: data ?? [] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }
}

export class JournalEntryRepository extends BaseRepository<TransactionEntry> {
  constructor() {
    super('journal_entries')
  }

  async getByAccount(accountId: string, limit?: number): Promise<{ data: TransactionEntry[]; error?: string }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*')
        .eq('accountId', accountId)
        .order('date', { ascending: false })

      if (limit) query = query.limit(limit)

      const { data, error } = await query
      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as TransactionEntry[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getUnposted(): Promise<{ data: TransactionEntry[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .in('status', ['draft', 'pending'])
        .order('date', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as TransactionEntry[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async postEntry(id: string, postedBy: string): Promise<{ data: TransactionEntry | null; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          status: 'posted',
          approvedBy: postedBy,
          approvedAt: Date.now(),
        } as Partial<TransactionEntry>)
        .eq('id', id)
        .select()
        .single()

      if (error) return { data: null, error: error.message }
      return { data: data as TransactionEntry }
    } catch (e) {
      return { data: null, error: (e as Error).message }
    }
  }

  async getForPeriod(start: number, end: number): Promise<{ data: TransactionEntry[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as TransactionEntry[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }
}

export class InvoiceRepository extends BaseRepository<Invoice> {
  constructor() {
    super('invoices')
  }

  async getByType(type: 'payable' | 'receivable'): Promise<{ data: Invoice[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('type', type)
        .order('date', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as Invoice[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getOverdue(): Promise<{ data: Invoice[]; error?: string }> {
    try {
      const now = Date.now()
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .lt('dueDate', now)
        .not('status', 'in', '("paid","cancelled")')
        .order('dueDate', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as Invoice[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getByCustomer(customerId: string): Promise<{ data: Invoice[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('type', 'receivable')
        .eq('vendorOrCustomer', customerId)
        .order('date', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as Invoice[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getBySupplier(supplierId: string): Promise<{ data: Invoice[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('type', 'payable')
        .eq('vendorOrCustomer', supplierId)
        .order('date', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as Invoice[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }
}

export const accountsRepo = new AccountRepository()
export const journalEntriesRepo = new JournalEntryRepository()
export const invoicesRepo = new InvoiceRepository()
