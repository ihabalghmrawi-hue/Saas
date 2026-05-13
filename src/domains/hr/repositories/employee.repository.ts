import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryError } from '@/repositories/base.repository'
import type { EmployeeEntity, EmployeeContractEntity, EmployeeDocumentEntity, EmployeeListItem } from '../entities/employee.entity'

export class EmployeeRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async generateEmployeeNo(): Promise<string> {
    const { data, error } = await this.db.rpc('generate_employee_no', { p_company_id: this.companyId })
    if (error) throw new RepositoryError(error.message, error.code)
    return data as string
  }

  async create(input: Partial<EmployeeEntity>): Promise<EmployeeEntity> {
    const { data, error } = await this.db.from('employees').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async findById(id: string): Promise<EmployeeEntity | null> {
    const { data, error } = await this.db.from('employees').select('*').eq('id', id).eq('company_id', this.companyId).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async findByEmail(email: string): Promise<EmployeeEntity | null> {
    const { data, error } = await this.db.from('employees').select('*').eq('email', email).eq('company_id', this.companyId).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async findPaged(opts: { page?: number; limit?: number; status?: string; departmentId?: string; branchId?: string; search?: string }): Promise<{ data: EmployeeListItem[]; count: number }> {
    let query = this.db.from('employees').select(`
      id, employee_no, full_name, full_name_ar, status, branch_id, hire_date,
      departments!left(name),
      positions!left(title)
    `, { count: 'exact' }).eq('company_id', this.companyId)

    if (opts.status) query = query.eq('status', opts.status)
    if (opts.departmentId) query = query.eq('department_id', opts.departmentId)
    if (opts.branchId) query = query.eq('branch_id', opts.branchId)
    if (opts.search) query = query.or(`full_name.ilike.%${opts.search}%,full_name_ar.ilike.%${opts.search}%,employee_no.ilike.%${opts.search}%`)

    const page = opts.page || 1; const limit = opts.limit || 50
    const { data, error, count } = await query.order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1)
    if (error) throw new RepositoryError(error.message, error.code)
    return { data: (data || []).map((r: any) => ({ ...r, department_name: r.departments?.name || null, position_title: r.positions?.title || null, total_salary: 0 })), count: count || 0 }
  }

  async update(id: string, input: Partial<EmployeeEntity>): Promise<EmployeeEntity> {
    const { data, error } = await this.db.from('employees').update(input).eq('id', id).eq('company_id', this.companyId).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async countByStatus(status: string): Promise<number> {
    const { count, error } = await this.db.from('employees').select('*', { count: 'exact', head: true }).eq('company_id', this.companyId).eq('status', status)
    if (error) throw new RepositoryError(error.message, error.code)
    return count || 0
  }

  async findActiveByDepartment(departmentId: string): Promise<EmployeeEntity[]> {
    const { data, error } = await this.db.from('employees').select('*').eq('company_id', this.companyId).eq('department_id', departmentId).eq('status', 'active')
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }
}

export class EmployeeContractRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findActiveByEmployee(employeeId: string): Promise<EmployeeContractEntity | null> {
    const { data, error } = await this.db.from('employee_contracts').select('*').eq('employee_id', employeeId).eq('is_active', true).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async create(input: Partial<EmployeeContractEntity>): Promise<EmployeeContractEntity> {
    const { data, error } = await this.db.from('employee_contracts').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async deactivateActive(employeeId: string): Promise<void> {
    const { error } = await this.db.from('employee_contracts').update({ is_active: false }).eq('employee_id', employeeId).eq('company_id', this.companyId).eq('is_active', true)
    if (error) throw new RepositoryError(error.message, error.code)
  }
}

export class EmployeeDocumentRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findByEmployee(employeeId: string): Promise<EmployeeDocumentEntity[]> {
    const { data, error } = await this.db.from('employee_documents').select('*').eq('employee_id', employeeId).eq('company_id', this.companyId)
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }

  async create(input: Partial<EmployeeDocumentEntity>): Promise<EmployeeDocumentEntity> {
    const { data, error } = await this.db.from('employee_documents').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }
}

export class DepartmentRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findAll(): Promise<any[]> {
    const { data, error } = await this.db.from('departments').select('*').eq('company_id', this.companyId).eq('is_active', true).order('name')
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }

  async findById(id: string): Promise<any | null> {
    const { data, error } = await this.db.from('departments').select('*').eq('id', id).eq('company_id', this.companyId).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async create(input: any): Promise<any> {
    const { data, error } = await this.db.from('departments').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async update(id: string, input: any): Promise<any> {
    const { data, error } = await this.db.from('departments').update(input).eq('id', id).eq('company_id', this.companyId).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }
}

export class PositionRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findByDepartment(departmentId: string): Promise<any[]> {
    const { data, error } = await this.db.from('positions').select('*').eq('department_id', departmentId).eq('company_id', this.companyId).eq('is_active', true)
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }

  async findById(id: string): Promise<any | null> {
    const { data, error } = await this.db.from('positions').select('*').eq('id', id).eq('company_id', this.companyId).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async create(input: any): Promise<any> {
    const { data, error } = await this.db.from('positions').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }
}
