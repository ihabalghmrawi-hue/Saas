import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseSalesRepository, RepositoryError } from './base'
import type { SalesOrderEntity, SalesOrderLineEntity } from '../entities/order.entity'

export class SalesOrderRepository extends BaseSalesRepository<SalesOrderEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'sales_orders') }

  async generateOrderNo(): Promise<string> {
    const { count } = await this.db.from('sales_orders').select('id', { count: 'exact', head: true }).eq('company_id', this.companyId)
    return `SO-${String((count || 0) + 1).padStart(6, '0')}`
  }

  async findByCustomer(customerId: string): Promise<SalesOrderEntity[]> {
    return this.findMany({ filters: { customer_id: customerId }, orderBy: 'created_at', orderDir: 'desc' })
  }

  async findByStatus(status: string): Promise<SalesOrderEntity[]> {
    return this.findMany({ filters: { status }, orderBy: 'created_at', orderDir: 'desc' })
  }
}

export class SalesOrderLineRepository extends BaseSalesRepository<SalesOrderLineEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'sales_order_lines') }

  async findByOrder(orderId: string): Promise<SalesOrderLineEntity[]> {
    return this.findMany({ filters: { order_id: orderId }, orderBy: 'line_no' })
  }

  async updateFulfilledQty(lineId: string, qty: number): Promise<void> {
    const line = await this.findById(lineId)
    if (!line) throw new RepositoryError('بند الأمر غير موجود')
    await this.update(lineId, { qty_fulfilled: (line.qty_fulfilled || 0) + qty } as any)
  }

  async updateInvoicedQty(lineId: string, qty: number): Promise<void> {
    const line = await this.findById(lineId)
    if (!line) throw new RepositoryError('بند الأمر غير موجود')
    await this.update(lineId, { qty_invoiced: (line.qty_invoiced || 0) + qty } as any)
  }

  async updateReturnedQty(lineId: string, qty: number): Promise<void> {
    const line = await this.findById(lineId)
    if (!line) throw new RepositoryError('بند الأمر غير موجود')
    await this.update(lineId, { qty_returned: (line.qty_returned || 0) + qty } as any)
  }
}
