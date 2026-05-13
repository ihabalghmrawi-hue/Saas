import type { SupabaseClient } from '@supabase/supabase-js'
import { AccountRepository } from '../repositories/account.repository'
import type { AccountEntity } from '../entities/account.entity'

export class AccountResolver {
  private readonly repo: AccountRepository
  private cache: Map<string, AccountEntity> = new Map()
  private codeCache: Map<string, AccountEntity> = new Map()
  private cacheLoaded = false

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.repo = new AccountRepository(db, companyId)
  }

  async resolveById(id: string): Promise<AccountEntity> {
    if (this.cache.has(id)) return this.cache.get(id)!
    const account = await this.repo.findActiveById(id)
    if (!account) throw new Error(`الحساب غير موجود: ${id}`)
    this.cache.set(account.id, account)
    this.codeCache.set(account.code, account)
    return account
  }

  async resolveByCode(code: string): Promise<AccountEntity> {
    if (this.codeCache.has(code)) return this.codeCache.get(code)!
    const account = await this.repo.findByCode(code)
    if (!account) throw new Error(`الحساب غير موجود: ${code}`)
    this.cache.set(account.id, account)
    this.codeCache.set(account.code, account)
    return account
  }

  async resolveManyByCode(codes: string[]): Promise<Map<string, AccountEntity>> {
    const result = new Map<string, AccountEntity>()
    const uncached: string[] = []

    for (const code of codes) {
      if (this.codeCache.has(code)) {
        result.set(code, this.codeCache.get(code)!)
      } else {
        uncached.push(code)
      }
    }

    if (uncached.length > 0) {
      const allAccounts = await this.repo.searchAccounts('')
      for (const account of allAccounts) {
        this.cache.set(account.id, account)
        this.codeCache.set(account.code, account)
      }
      for (const code of uncached) {
        if (this.codeCache.has(code)) {
          result.set(code, this.codeCache.get(code)!)
        }
      }
    }

    return result
  }

  async loadAll(): Promise<void> {
    if (this.cacheLoaded) return
    const accounts = await this.repo.findAllActive()
    for (const account of accounts) {
      this.cache.set(account.id, account)
      this.codeCache.set(account.code, account)
    }
    this.cacheLoaded = true
  }

  invalidate(): void {
    this.cache.clear()
    this.codeCache.clear()
    this.cacheLoaded = false
  }
}
