import { BaseRepository } from './base-repository'
import type { RepositoryEvent } from './base-repository'
import { accountsRepo, journalEntriesRepo, invoicesRepo } from './financial-repository'
import { inventoryItemsRepo, stockMovementsRepo } from './inventory-repository'
import { purchaseOrdersRepo, suppliersRepo } from './procurement-repository'
import { salesOrdersRepo, customersRepo } from './sales-repository'
import { payrollRunsRepo, payrollEmployeesRepo } from './payroll-repository'
import {
  workflowInstancesRepo,
  approvalRequestsRepo,
  workflowEventsRepo,
  activityEntriesRepo,
} from './workflow-repository'

export { BaseRepository }
export type { RepositoryEvent }
export { accountsRepo, journalEntriesRepo, invoicesRepo }
export { inventoryItemsRepo, stockMovementsRepo }
export { purchaseOrdersRepo, suppliersRepo }
export { salesOrdersRepo, customersRepo }
export { payrollRunsRepo, payrollEmployeesRepo }
export { workflowInstancesRepo, approvalRequestsRepo, workflowEventsRepo, activityEntriesRepo }

export const repositories = {
  accounts: accountsRepo,
  journalEntries: journalEntriesRepo,
  invoices: invoicesRepo,
  inventoryItems: inventoryItemsRepo,
  stockMovements: stockMovementsRepo,
  purchaseOrders: purchaseOrdersRepo,
  suppliers: suppliersRepo,
  salesOrders: salesOrdersRepo,
  customers: customersRepo,
  payrollRuns: payrollRunsRepo,
  payrollEmployees: payrollEmployeesRepo,
  workflowInstances: workflowInstancesRepo,
  approvalRequests: approvalRequestsRepo,
  workflowEvents: workflowEventsRepo,
  activityEntries: activityEntriesRepo,
} as const
