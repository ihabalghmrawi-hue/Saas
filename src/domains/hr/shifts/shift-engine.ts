import type { SupabaseClient } from '@supabase/supabase-js'
import { ShiftRepository, ShiftAssignmentRepository } from '../repositories/attendance.repository'
import type { ShiftEntity, ShiftAssignmentEntity, CreateShiftInput } from '../entities/attendance.entity'
import type { ServiceResult } from '../types'

export class ShiftEngine {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  private get shiftRepo() { return new ShiftRepository(this.db, this.companyId) }
  private get assignRepo() { return new ShiftAssignmentRepository(this.db, this.companyId) }

  async createShift(input: CreateShiftInput): Promise<ServiceResult<ShiftEntity>> {
    try {
      const shift = await this.shiftRepo.create(input as any)
      return { ok: true, data: shift }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'SHIFT_CREATE_FAILED' }
    }
  }

  async assignShift(employeeId: string, shiftId: string, effectiveFrom: string): Promise<ServiceResult<ShiftAssignmentEntity>> {
    try {
      await this.assignRepo.deactivateAll(employeeId)
      const assignment = await this.assignRepo.assign({ employee_id: employeeId, shift_id: shiftId, effective_from: effectiveFrom })
      return { ok: true, data: assignment }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ASSIGN_FAILED' }
    }
  }

  async getEmployeeShift(employeeId: string): Promise<ServiceResult<ShiftAssignmentEntity | null>> {
    try {
      const assignment = await this.assignRepo.findActiveByEmployee(employeeId)
      return { ok: true, data: assignment }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async listShifts(): Promise<ServiceResult<ShiftEntity[]>> {
    try {
      const shifts = await this.shiftRepo.findAll()
      return { ok: true, data: shifts }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }
}
