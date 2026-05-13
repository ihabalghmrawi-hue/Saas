import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseSalesRepository, RepositoryError } from './base'
import type { CustomerWalletEntity, WalletTransactionEntity } from '../entities/wallet.entity'

export class CustomerWalletRepository extends BaseSalesRepository<CustomerWalletEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'customer_wallets') }

  async findByCustomer(customerId: string): Promise<CustomerWalletEntity | null> {
    const { data, error } = await this.db
      .from('customer_wallets')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('customer_id', customerId)
      .single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new RepositoryError(error.message, error.code)
    }
    return data as CustomerWalletEntity
  }

  async ensureWallet(customerId: string): Promise<CustomerWalletEntity> {
    const existing = await this.findByCustomer(customerId)
    if (existing) return existing
    return this.create({ customer_id: customerId, balance: 0, credit_limit: 0, currency: 'SAR' } as any)
  }

  async updateBalance(walletId: string, newBalance: number): Promise<void> {
    await this.update(walletId, { balance: newBalance } as any)
  }
}

export class WalletTransactionRepository extends BaseSalesRepository<WalletTransactionEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'wallet_transactions') }

  async findByWallet(walletId: string): Promise<WalletTransactionEntity[]> {
    return this.findMany({ filters: { wallet_id: walletId }, orderBy: 'created_at', orderDir: 'desc' })
  }
}
