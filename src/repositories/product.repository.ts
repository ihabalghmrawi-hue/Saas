import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository, RepositoryError } from './base.repository'
import type { ProductResponse } from '@/validators/product'

const WITH_RELATIONS = `
  *,
  product_categories (id, name, name_ar, color),
  units              (id, name, name_ar, abbreviation),
  inventory          (quantity, warehouse_id)
`.trim()

export class ProductRepository extends BaseRepository<ProductResponse> {
  protected readonly table = 'products'
  protected hasSoftDelete  = true

  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId)
  }

  async findByIdWithRelations(id: string): Promise<ProductResponse | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select(WITH_RELATIONS)
      .eq('company_id', this.companyId)
      .eq('id', id)
      .eq('is_deleted', false)
      .single()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return data as unknown as ProductResponse
  }

  async findBySku(sku: string): Promise<ProductResponse | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('company_id', this.companyId)
      .eq('sku', sku)
      .eq('is_deleted', false)
      .maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? null) as ProductResponse | null
  }

  async findByBarcode(barcode: string): Promise<ProductResponse | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('company_id', this.companyId)
      .eq('barcode', barcode)
      .eq('is_deleted', false)
      .maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? null) as ProductResponse | null
  }

  async search(query: string, limit = 20): Promise<ProductResponse[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select(WITH_RELATIONS)
      .eq('company_id', this.companyId)
      .eq('is_deleted', false)
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%`)
      .limit(limit)
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as ProductResponse[]
  }

  async listPaged(opts: { limit: number; offset: number; categoryId?: string }): Promise<{ data: ProductResponse[]; count: number }> {
    let q = this.db
      .from(this.table)
      .select(WITH_RELATIONS, { count: 'exact' })
      .eq('company_id', this.companyId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1)

    if (opts.categoryId) q = q.eq('category_id', opts.categoryId) as typeof q

    const { data, error, count } = await q
    if (error) throw new RepositoryError(error.message, error.code)
    return { data: (data ?? []) as unknown as ProductResponse[], count: count ?? 0 }
  }

  async countActive(): Promise<number> {
    const { count, error } = await this.db
      .from(this.table)
      .select('id', { count: 'exact', head: true })
      .eq('company_id', this.companyId)
      .eq('is_deleted', false)
    if (error) throw new RepositoryError(error.message, error.code)
    return count ?? 0
  }
}
