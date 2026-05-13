import type { SupabaseClient } from '@supabase/supabase-js'
import { EmployeeRepository, EmployeeContractRepository, DepartmentRepository, PositionRepository } from '../repositories/employee.repository'
import { HrEventBus } from '../events/event-bus'
import { CreateEmployeeSchema, CreateContractSchema } from '../validators'
import type { EmployeeEntity, CreateEmployeeInput, UpdateEmployeeInput, CreateContractInput, EmployeeListItem } from '../entities/employee.entity'
import type { ServiceResult, EmploymentStatus } from '../types'

export class EmployeeLifecycleEngine {
  private readonly repo: EmployeeRepository
  private readonly contractRepo: EmployeeContractRepository
  private readonly deptRepo: DepartmentRepository
  private readonly posRepo: PositionRepository
  private readonly eventBus: HrEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.repo = new EmployeeRepository(db, companyId)
    this.contractRepo = new EmployeeContractRepository(db, companyId)
    this.deptRepo = new DepartmentRepository(db, companyId)
    this.posRepo = new PositionRepository(db, companyId)
    this.eventBus = HrEventBus.getInstance()
  }

  async onboard(input: CreateEmployeeInput & { contract?: CreateContractInput }): Promise<ServiceResult<EmployeeEntity>> {
    const parsed = CreateEmployeeSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.errors.map(e => e.message).join('; '), code: 'VALIDATION_ERROR' }

    const existing = await this.repo.findByEmail(input.email || '')
    if (input.email && existing) return { ok: false, error: 'البريد الإلكتروني مستخدم بالفعل', code: 'EMAIL_EXISTS' }

    try {
      const employeeNo = await this.repo.generateEmployeeNo()
      const employee = await this.repo.create({ employee_no: employeeNo, ...input })

      if (input.contract) {
        await this.createContract({ ...input.contract, employee_id: employee.id })
      }

      this.eventBus.emit('hr.employee.hired', {
        id: employee.id, type: 'hr.employee.hired', companyId: this.companyId,
        employeeId: employee.id, branchId: input.branch_id, timestamp: new Date().toISOString(),
        metadata: { employeeNo, departmentId: input.department_id, positionId: input.position_id },
      })

      return { ok: true, data: employee }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ONBOARD_FAILED' }
    }
  }

  async transfer(employeeId: string, input: { department_id?: string; position_id?: string; branch_id?: string; cost_center_id?: string; reason?: string }, performedBy?: string): Promise<ServiceResult<EmployeeEntity>> {
    const employee = await this.repo.findById(employeeId)
    if (!employee) return { ok: false, error: 'الموظف غير موجود', code: 'NOT_FOUND' }
    if (employee.status !== 'active') return { ok: false, error: 'يمكن نقل الموظفين النشطين فقط', code: 'INVALID_STATUS' }

    try {
      const updated = await this.repo.update(employeeId, {
        department_id: input.department_id ?? employee.department_id,
        position_id: input.position_id ?? employee.position_id,
        branch_id: input.branch_id ?? employee.branch_id,
        cost_center_id: input.cost_center_id ?? employee.cost_center_id,
      })

      this.eventBus.emit('hr.employee.transferred', {
        id: employeeId, type: 'hr.employee.transferred', companyId: this.companyId,
        employeeId, timestamp: new Date().toISOString(), performedBy,
        metadata: { oldDepartment: employee.department_id, newDepartment: input.department_id, reason: input.reason },
      })

      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'TRANSFER_FAILED' }
    }
  }

  async promote(employeeId: string, input: { position_id: string; grade?: string; level?: number; salary_increase?: number; reason?: string }, performedBy?: string): Promise<ServiceResult<EmployeeEntity>> {
    const employee = await this.repo.findById(employeeId)
    if (!employee) return { ok: false, error: 'الموظف غير موجود', code: 'NOT_FOUND' }
    if (employee.status !== 'active') return { ok: false, error: 'يمكن ترقية الموظفين النشطين فقط', code: 'INVALID_STATUS' }

    const position = await this.posRepo.findById(input.position_id)
    if (!position) return { ok: false, error: 'المنصب غير موجود', code: 'POSITION_NOT_FOUND' }

    try {
      const updated = await this.repo.update(employeeId, {
        position_id: input.position_id, grade: input.grade ?? employee.grade, level: input.level ?? employee.level,
      })

      if (input.salary_increase && input.salary_increase > 0) {
        const contract = await this.contractRepo.findActiveByEmployee(employeeId)
        if (contract) {
          const newBasic = contract.basic_salary + input.salary_increase
          await this.contractRepo.deactivateActive(employeeId)
          await this.contractRepo.create({
            employee_id: employeeId, contract_type: contract.contract_type,
            start_date: new Date().toISOString().slice(0, 10), basic_salary: newBasic,
            housing_allowance: contract.housing_allowance, transportation_allowance: contract.transportation_allowance,
            communication_allowance: contract.communication_allowance,
            cost_of_living_allowance: contract.cost_of_living_allowance,
            other_allowances: contract.other_allowances,
          })
        }
      }

      this.eventBus.emit('hr.employee.promoted', {
        id: employeeId, type: 'hr.employee.promoted', companyId: this.companyId,
        employeeId, timestamp: new Date().toISOString(), performedBy,
        metadata: { oldPosition: employee.position_id, newPosition: input.position_id, reason: input.reason },
      })

      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'PROMOTION_FAILED' }
    }
  }

  async suspend(employeeId: string, reason: string, performedBy?: string): Promise<ServiceResult<EmployeeEntity>> {
    return this.changeStatus(employeeId, 'suspended', reason, performedBy)
  }

  async terminate(employeeId: string, reason: string, performedBy?: string): Promise<ServiceResult<EmployeeEntity>> {
    return this.changeStatus(employeeId, 'terminated', reason, performedBy)
  }

  async rehire(employeeId: string, input: { hire_date: string; contract?: CreateContractInput }, performedBy?: string): Promise<ServiceResult<EmployeeEntity>> {
    const employee = await this.repo.findById(employeeId)
    if (!employee) return { ok: false, error: 'الموظف غير موجود', code: 'NOT_FOUND' }
    if (!['terminated', 'resigned', 'retired'].includes(employee.status)) {
      return { ok: false, error: 'يمكن إعادة تعيين الموظفين المنتهية خدماتهم فقط', code: 'INVALID_STATUS' }
    }

    try {
      const updated = await this.repo.update(employeeId, { status: 'active', hire_date: input.hire_date })

      if (input.contract) {
        await this.createContract({ ...input.contract, employee_id: employeeId })
      }

      this.eventBus.emit('hr.employee.rehired', {
        id: employeeId, type: 'hr.employee.rehired', companyId: this.companyId,
        employeeId, timestamp: new Date().toISOString(), performedBy,
      })

      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'REHIRE_FAILED' }
    }
  }

  private async changeStatus(employeeId: string, status: EmploymentStatus, reason: string, performedBy?: string): Promise<ServiceResult<EmployeeEntity>> {
    const employee = await this.repo.findById(employeeId)
    if (!employee) return { ok: false, error: 'الموظف غير موجود', code: 'NOT_FOUND' }

    try {
      const updated = await this.repo.update(employeeId, { status })
      this.eventBus.emit(status === 'suspended' ? 'hr.employee.suspended' : 'hr.employee.terminated', {
        id: employeeId, type: status === 'suspended' ? 'hr.employee.suspended' : 'hr.employee.terminated',
        companyId: this.companyId, employeeId, timestamp: new Date().toISOString(), performedBy,
        metadata: { reason },
      })
      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: `${status.toUpperCase()}_FAILED` }
    }
  }

  private async createContract(input: CreateContractInput & { employee_id: string }): Promise<ServiceResult<any>> {
    const parsed = CreateContractSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.errors.map(e => e.message).join('; '), code: 'VALIDATION_ERROR' }

    await this.contractRepo.deactivateActive(input.employee_id)
    const totalSalary = input.basic_salary + (input.housing_allowance || 0) + (input.transportation_allowance || 0) + (input.communication_allowance || 0) + (input.cost_of_living_allowance || 0) + (input.other_allowances || 0)

    try {
      const contract = await this.contractRepo.create({ ...input, total_salary: totalSalary })
      return { ok: true, data: contract }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CONTRACT_FAILED' }
    }
  }

  async getById(id: string): Promise<ServiceResult<EmployeeEntity>> {
    const employee = await this.repo.findById(id)
    if (!employee) return { ok: false, error: 'الموظف غير موجود', code: 'NOT_FOUND' }
    return { ok: true, data: employee }
  }

  async list(filters: { page?: number; limit?: number; status?: string; departmentId?: string; branchId?: string; search?: string }): Promise<ServiceResult<{ data: EmployeeListItem[]; count: number }>> {
    try {
      const result = await this.repo.findPaged(filters)
      return { ok: true, data: result }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }
}
