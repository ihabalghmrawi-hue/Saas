export type DataType = 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'badge' | 'action' | 'custom'

export interface Column<T = any> {
  id: string
  title: string
  dataType: DataType
  width?: number
  minWidth?: number
  maxWidth?: number
  sortable?: boolean
  filterable?: boolean
  groupable?: boolean
  pinned?: 'left' | 'right'
  visible?: boolean
  resizable?: boolean
  align?: 'left' | 'center' | 'right'
  render?: (value: any, row: T, index: number) => React.ReactNode
  getValue?: (row: T) => any
  getFilterOptions?: (rows: T[]) => { label: string; value: string }[]
  footer?: 'sum' | 'avg' | 'count'
}

export interface FilterConfig {
  id: string
  type: 'text' | 'select' | 'number' | 'date' | 'boolean'
  operator: 'contains' | 'equals' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in'
  value: any
  label: string
}

export interface SortConfig {
  id: string
  dir: 'asc' | 'desc'
}

export interface GroupConfig {
  id: string
  expanded?: boolean
}

export interface PaginationConfig {
  page: number
  pageSize: number
  total: number
}

export interface SavedView {
  id: string
  name: string
  filters: FilterConfig[]
  sorts: SortConfig[]
  groupBy?: string
  columnOrder: string[]
  columnWidths: Record<string, number>
  isDefault?: boolean
}

export interface DataGridProps<T = any> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  error?: string
  selectable?: boolean
  selectedRows?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  sortable?: boolean
  sorts?: SortConfig[]
  onSortChange?: (sorts: SortConfig[]) => void
  filterable?: boolean
  filters?: FilterConfig[]
  onFilterChange?: (filters: FilterConfig[]) => void
  groupable?: boolean
  groupBy?: string
  onGroupByChange?: (field: string | undefined) => void
  pagination?: PaginationConfig
  onPaginationChange?: (pagination: PaginationConfig) => void
  rowKey?: (row: T) => string
  rowActions?: (row: T) => React.ReactNode
  bulkActions?: React.ReactNode
  emptyState?: React.ReactNode
  onRowClick?: (row: T) => void
  onRowDoubleClick?: (row: T) => void
  savedViews?: SavedView[]
  onSaveView?: (view: Omit<SavedView, 'id'>) => void
  onLoadView?: (view: SavedView) => void
  onDeleteView?: (id: string) => void
  onExport?: (format: 'csv' | 'xlsx' | 'pdf') => void
  virtualize?: boolean
  rowHeight?: number
  className?: string
  stickyHeader?: boolean
}

export interface DataGridHandlers {
  exportToCSV: () => void
  exportToXLSX: () => void
  exportToPDF: () => void
  print: () => void
  resetFilters: () => void
  resetSorts: () => void
}

export function getRowValue<T>(row: T, column: Column<T>): any {
  if (column.getValue) return column.getValue(row)
  return (row as any)[column.id]
}

export function formatCellValue(value: any, column: Column): string {
  if (value === null || value === undefined) return '-'
  switch (column.dataType) {
    case 'currency':
      return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(value)
    case 'number':
      return new Intl.NumberFormat('ar-SA').format(value)
    case 'date':
      return new Date(value).toLocaleDateString('ar-SA')
    case 'boolean':
      return value ? 'نعم' : 'لا'
    default:
      return String(value)
  }
}

export function filterData<T>(data: T[], columns: Column<T>[], filters: FilterConfig[]): T[] {
  if (!filters.length) return data
  return data.filter(row => {
    return filters.every(filter => {
      const col = columns.find(c => c.id === filter.id)
      if (!col) return true
      const value = getRowValue(row, col)
      switch (filter.operator) {
        case 'contains': return String(value).includes(String(filter.value))
        case 'equals': return value === filter.value
        case 'gt': return Number(value) > Number(filter.value)
        case 'gte': return Number(value) >= Number(filter.value)
        case 'lt': return Number(value) < Number(filter.value)
        case 'lte': return Number(value) <= Number(filter.value)
        case 'in': return Array.isArray(filter.value) && filter.value.includes(value)
        default: return true
      }
    })
  })
}

export function sortData<T>(data: T[], columns: Column<T>[], sorts: SortConfig[]): T[] {
  if (!sorts.length) return data
  return [...data].sort((a, b) => {
    for (const sort of sorts) {
      const col = columns.find(c => c.id === sort.id)
      if (!col) continue
      const va = getRowValue(a, col)
      const vb = getRowValue(b, col)
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      if (cmp !== 0) return sort.dir === 'asc' ? cmp : -cmp
    }
    return 0
  })
}

export function paginateData<T>(data: T[], pagination: PaginationConfig): T[] {
  const { page, pageSize } = pagination
  const start = (page - 1) * pageSize
  return data.slice(start, start + pageSize)
}

export function groupData<T>(data: T[], columns: Column<T>[], groupBy?: string): Record<string, T[]> {
  if (!groupBy) return { 'all': data }
  const col = columns.find(c => c.id === groupBy)
  if (!col) return { 'all': data }
  const groups: Record<string, T[]> = {}
  for (const row of data) {
    const key = String(getRowValue(row, col) ?? '')
    if (!groups[key]) groups[key] = []
    groups[key].push(row)
  }
  return groups
}
