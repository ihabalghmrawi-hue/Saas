import type { SupabaseClient } from '@supabase/supabase-js'
import { AccountRepository } from '../repositories/account.repository'
import { CreateAccountSchema, UpdateAccountSchema, AccountQuerySchema } from '../validators/account.schema'
import type { AccountEntity, AccountTree, CreateAccountInput, UpdateAccountInput, AccountBalance } from '../entities/account.entity'
import type { ServiceResult } from '../types'

export class ChartOfAccountsService {
  private readonly repo: AccountRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.repo = new AccountRepository(db, companyId)
  }

  async create(input: CreateAccountInput): Promise<ServiceResult<AccountEntity>> {
    const parsed = CreateAccountSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors.map(e => e.message).join('; '), code: 'VALIDATION_ERROR' }
    }

    const existing = await this.repo.findByCode(parsed.data.code)
    if (existing) {
      return { ok: false, error: `رمز الحساب ${parsed.data.code} مستخدم بالفعل`, code: 'DUPLICATE_CODE' }
    }

    if (parsed.data.parent_id) {
      const parent = await this.repo.findActiveById(parsed.data.parent_id)
      if (!parent) {
        return { ok: false, error: 'الحساب الأب غير موجود', code: 'PARENT_NOT_FOUND' }
      }
      if (parent.level >= parsed.data.level) {
        return { ok: false, error: 'مستوى الحساب الفرعي يجب أن يكون أكبر من مستوى الحساب الأب', code: 'INVALID_LEVEL' }
      }
    }

    try {
      const account = await this.repo.createAccount(parsed.data)
      return { ok: true, data: account }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CREATE_FAILED' }
    }
  }

  async update(id: string, input: UpdateAccountInput): Promise<ServiceResult<AccountEntity>> {
    const existing = await this.repo.findActiveById(id)
    if (!existing) {
      return { ok: false, error: 'الحساب غير موجود', code: 'NOT_FOUND' }
    }

    if (existing.is_system && input.is_active === false) {
      return { ok: false, error: 'لا يمكن تعطيل حساب نظامي', code: 'SYSTEM_ACCOUNT' }
    }

    const parsed = UpdateAccountSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors.map(e => e.message).join('; '), code: 'VALIDATION_ERROR' }
    }

    if (parsed.data.parent_id) {
      const parent = await this.repo.findActiveById(parsed.data.parent_id)
      if (!parent) {
        return { ok: false, error: 'الحساب الأب غير موجود', code: 'PARENT_NOT_FOUND' }
      }
      const descendants = await this.repo.findDescendantIds(id)
      if (descendants.includes(parsed.data.parent_id)) {
        return { ok: false, error: 'لا يمكن جعل الحساب الفرعي أباً لنفسه', code: 'CIRCULAR_REFERENCE' }
      }
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name
    if (parsed.data.name_ar !== undefined) updateData.name_ar = parsed.data.name_ar
    if (parsed.data.is_active !== undefined) updateData.is_active = parsed.data.is_active
    if (parsed.data.is_postable !== undefined) updateData.is_postable = parsed.data.is_postable
    if (parsed.data.is_header !== undefined) updateData.is_header = parsed.data.is_header
    if (parsed.data.parent_id !== undefined) updateData.parent_id = parsed.data.parent_id
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description
    if (parsed.data.account_group !== undefined) updateData.account_group = parsed.data.account_group
    if (parsed.data.tax_rate !== undefined) updateData.tax_rate = parsed.data.tax_rate
    if (parsed.data.opening_balance !== undefined) updateData.opening_balance = parsed.data.opening_balance

    try {
      const account = await this.repo.updateAccount(id, updateData)
      return { ok: true, data: account }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'UPDATE_FAILED' }
    }
  }

  async getById(id: string): Promise<ServiceResult<AccountEntity>> {
    const account = await this.repo.findActiveById(id)
    if (!account) return { ok: false, error: 'الحساب غير موجود', code: 'NOT_FOUND' }
    return { ok: true, data: account }
  }

  async getByCode(code: string): Promise<ServiceResult<AccountEntity>> {
    const account = await this.repo.findByCode(code)
    if (!account) return { ok: false, error: 'الحساب غير موجود', code: 'NOT_FOUND' }
    return { ok: true, data: account }
  }

  async getTree(): Promise<ServiceResult<AccountTree[]>> {
    try {
      const tree = await this.repo.getAccountTree()
      return { ok: true, data: tree }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async getAllActive(): Promise<ServiceResult<AccountEntity[]>> {
    try {
      const accounts = await this.repo.findAllActive()
      return { ok: true, data: accounts }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async getByType(type: AccountEntity['type']): Promise<ServiceResult<AccountEntity[]>> {
    try {
      const accounts = await this.repo.getByType(type)
      return { ok: true, data: accounts }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async toggleActive(id: string, isActive: boolean): Promise<ServiceResult<AccountEntity>> {
    const existing = await this.repo.findActiveById(id)
    if (!existing) {
      return { ok: false, error: 'الحساب غير موجود', code: 'NOT_FOUND' }
    }
    if (existing.is_system && !isActive) {
      return { ok: false, error: 'لا يمكن تعطيل حساب نظامي', code: 'SYSTEM_ACCOUNT' }
    }

    try {
      const account = await this.repo.toggleActive(id, isActive)
      return { ok: true, data: account }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'UPDATE_FAILED' }
    }
  }

  async getBalances(accountIds?: string[]): Promise<ServiceResult<AccountBalance[]>> {
    try {
      const accounts = accountIds
        ? (await Promise.all(accountIds.map(id => this.repo.findActiveById(id)))).filter(Boolean) as AccountEntity[]
        : await this.repo.findAllActive()

      const balances: AccountBalance[] = accounts.map(a => {
        const balance = a.normal_balance === 'debit' ? a.current_balance : -a.current_balance
        return {
          account_id: a.id,
          account_code: a.code,
          account_name: a.name,
          account_name_ar: a.name_ar,
          type: a.type,
          normal_balance: a.normal_balance,
          opening_debit: a.normal_balance === 'debit' ? a.opening_balance : 0,
          opening_credit: a.normal_balance === 'credit' ? a.opening_balance : 0,
          period_debit: balance > 0 ? balance : 0,
          period_credit: balance < 0 ? Math.abs(balance) : 0,
          closing_debit: a.current_balance > 0 ? a.current_balance : 0,
          closing_credit: a.current_balance < 0 ? Math.abs(a.current_balance) : 0,
          balance: a.current_balance,
        }
      })
      return { ok: true, data: balances }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async search(query: string): Promise<ServiceResult<AccountEntity[]>> {
    try {
      const accounts = await this.repo.searchAccounts(query)
      return { ok: true, data: accounts }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'SEARCH_FAILED' }
    }
  }
}
