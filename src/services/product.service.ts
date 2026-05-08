import type { SupabaseClient }  from '@supabase/supabase-js'
import { ProductRepository }    from '@/repositories/product.repository'
import { checkLimit }           from '@/lib/usage-limits'
import { logAudit }             from '@/lib/audit'
import type { CreateProductInput, UpdateProductInput, ProductResponse } from '@/validators/product'
import type { Plan } from '@/validators/subscription'

export type ServiceResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string; code?: string }

export class ProductService {
  private readonly repo: ProductRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
    private readonly plan: Plan = 'free',
  ) {
    this.repo = new ProductRepository(db, companyId)
  }

  async create(input: CreateProductInput): Promise<ServiceResult<ProductResponse>> {
    // Enforce plan limits before writing
    const limit = await checkLimit(this.db, this.companyId, this.plan, 'products')
    if (!limit.allowed) return { ok: false, error: limit.message, code: 'LIMIT_EXCEEDED' }

    // Prevent duplicate SKU within company
    if (input.sku) {
      const existing = await this.repo.findBySku(input.sku)
      if (existing) return { ok: false, error: 'رمز المنتج (SKU) مستخدم بالفعل', code: 'CONFLICT' }
    }

    try {
      const product = await this.repo.create(input as Record<string, unknown>)
      await logAudit({ action: 'product.created', entityType: 'product', entityId: product.id })
      return { ok: true, data: product }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  async update(id: string, input: UpdateProductInput): Promise<ServiceResult<ProductResponse>> {
    const existing = await this.repo.findById(id)
    if (!existing) return { ok: false, error: 'المنتج غير موجود', code: 'NOT_FOUND' }

    if (input.sku && input.sku !== existing.sku) {
      const collision = await this.repo.findBySku(input.sku)
      if (collision && (collision as any).id !== id) {
        return { ok: false, error: 'رمز المنتج (SKU) مستخدم بالفعل', code: 'CONFLICT' }
      }
    }

    try {
      const product = await this.repo.update(id, input as Record<string, unknown>)
      await logAudit({ action: 'product.updated', entityType: 'product', entityId: id })
      return { ok: true, data: product }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  async delete(id: string): Promise<ServiceResult<{ id: string }>> {
    const existing = await this.repo.findById(id)
    if (!existing) return { ok: false, error: 'المنتج غير موجود', code: 'NOT_FOUND' }

    try {
      await this.repo.softDeleteById(id)
      await logAudit({ action: 'product.deleted', entityType: 'product', entityId: id, severity: 'warning' })
      return { ok: true, data: { id } }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  async getById(id: string): Promise<ServiceResult<ProductResponse>> {
    const product = await this.repo.findByIdWithRelations(id)
    if (!product) return { ok: false, error: 'المنتج غير موجود', code: 'NOT_FOUND' }
    return { ok: true, data: product }
  }

  async list(opts: { limit: number; offset: number; categoryId?: string }) {
    const result = await this.repo.listPaged(opts)
    return { ok: true as const, data: result }
  }
}
