import type { EmploymentStatus, ContractType, Gender, MaritalStatus } from '../types'

export interface EmployeeEntity {
  id: string
  company_id: string
  employee_no: string
  full_name: string
  full_name_ar: string
  email: string | null
  phone: string | null
  gender: Gender
  marital_status: MaritalStatus | null
  nationality: string | null
  id_number: string | null
  passport_number: string | null
  date_of_birth: string | null
  hire_date: string
  status: EmploymentStatus
  department_id: string | null
  position_id: string | null
  branch_id: string | null
  cost_center_id: string | null
  reports_to: string | null
  grade: string | null
  level: number | null
  created_at: string
  updated_at: string
}

export interface EmployeeContractEntity {
  id: string
  company_id: string
  employee_id: string
  contract_type: ContractType
  start_date: string
  end_date: string | null
  probation_end_date: string | null
  basic_salary: number
  housing_allowance: number
  transportation_allowance: number
  communication_allowance: number
  cost_of_living_allowance: number
  other_allowances: number
  total_salary: number
  bank_name: string | null
  bank_account: string | null
  iban: string | null
  is_active: boolean
  signed_at: string | null
  created_at: string
  updated_at: string
}

export interface EmployeeDocumentEntity {
  id: string
  company_id: string
  employee_id: string
  document_type: string
  document_name: string
  file_url: string
  expiry_date: string | null
  is_verified: boolean
  created_at: string
}

export interface DepartmentEntity {
  id: string
  company_id: string
  name: string
  name_ar: string
  code: string
  parent_id: string | null
  manager_id: string | null
  cost_center_id: string | null
  is_active: boolean
  created_at: string
}

export interface PositionEntity {
  id: string
  company_id: string
  department_id: string
  title: string
  title_ar: string
  code: string
  grade: string | null
  level: number | null
  min_salary: number | null
  max_salary: number | null
  is_active: boolean
  created_at: string
}

export interface EmployeeListItem {
  id: string
  employee_no: string
  full_name: string
  full_name_ar: string
  status: EmploymentStatus
  department_name: string | null
  position_title: string | null
  branch_id: string | null
  hire_date: string
  total_salary: number
}

export interface CreateEmployeeInput {
  full_name: string
  full_name_ar: string
  email?: string
  phone?: string
  gender: Gender
  marital_status?: MaritalStatus
  nationality?: string
  id_number?: string
  passport_number?: string
  date_of_birth?: string
  hire_date: string
  department_id?: string
  position_id?: string
  branch_id?: string
  cost_center_id?: string
  reports_to?: string
  grade?: string
  level?: number
}

export interface UpdateEmployeeInput extends Partial<CreateEmployeeInput> {
  status?: EmploymentStatus
}

export interface CreateContractInput {
  employee_id: string
  contract_type: ContractType
  start_date: string
  end_date?: string
  probation_end_date?: string
  basic_salary: number
  housing_allowance?: number
  transportation_allowance?: number
  communication_allowance?: number
  cost_of_living_allowance?: number
  other_allowances?: number
  bank_name?: string
  bank_account?: string
  iban?: string
}
