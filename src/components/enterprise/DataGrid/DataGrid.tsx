'use client'

import { useState, useMemo, useCallback, useRef, useImperativeHandle, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import {
  ArrowUpDown, ArrowUp, ArrowDown, Search, X, ChevronDown, ChevronLeft, ChevronRight,
  Download, Printer, Columns3, Filter, Group, Save, Eye, EyeOff,
  Check, Loader2, AlertCircle, FileText,
} from 'lucide-react'
import {
  type Column, type FilterConfig, type SortConfig, type GroupConfig,
  type PaginationConfig, type SavedView, type DataGridProps, type DataGridHandlers,
  getRowValue, formatCellValue, filterData, sortData, paginateData, groupData,
} from '@/lib/datagrid/types'

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100]

function DataGridInner<T extends Record<string, any>>(props: DataGridProps<T>, ref: React.Ref<DataGridHandlers>) {
  const {
    columns: propColumns, data, loading, error, selectable, selectedRows, onSelectionChange,
    sortable = true, sorts: externalSorts, onSortChange,
    filterable = true, filters: externalFilters, onFilterChange,
    groupable, groupBy: externalGroupBy, onGroupByChange,
    pagination: externalPagination, onPaginationChange,
    rowKey = (row: T) => String(row.id ?? Math.random()),
    rowActions, bulkActions, emptyState, onRowClick, onRowDoubleClick,
    savedViews, onSaveView, onLoadView, onDeleteView, onExport,
    virtualize, rowHeight = 48, className, stickyHeader = true,
  } = props

  const [internalSorts, setInternalSorts] = useState<SortConfig[]>([])
  const [internalFilters, setInternalFilters] = useState<FilterConfig[]>([])
  const [internalPagination, setInternalPagination] = useState<PaginationConfig>({ page: 1, pageSize: 25, total: 0 })
  const [internalGroupBy, setInternalGroupBy] = useState<string | undefined>()
  const [showFilterRow, setShowFilterRow] = useState(false)
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null)
  const [showColumnMenu, setShowColumnMenu] = useState<string | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showViewMenu, setShowViewMenu] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['all']))

  const sorts = externalSorts ?? internalSorts
  const setSorts = onSortChange ?? setInternalSorts
  const filters = externalFilters ?? internalFilters
  const setFilters = onFilterChange ?? setInternalFilters
  const pagination = externalPagination ?? internalPagination
  const setPagination = onPaginationChange ?? setInternalPagination
  const groupBy = externalGroupBy ?? internalGroupBy

  const processed = useMemo(() => {
    const filtered = filterData(data, propColumns, filters)
    const sorted = sortData(filtered, propColumns, sorts)
    return { filtered, sorted }
  }, [data, propColumns, filters, sorts])

  const { filtered, sorted } = processed

  const grouped = useMemo(() => groupData(sorted, propColumns, groupBy), [sorted, propColumns, groupBy])

  const totalFiltered = filtered.length
  const totalPages = Math.ceil(totalFiltered / pagination.pageSize)
  const paged = paginateData(sorted, { ...pagination, total: totalFiltered })

  const visibleColumns = useMemo(() => propColumns.filter(c => c.visible !== false), [propColumns])

  const toggleSort = (colId: string) => {
    const existing = sorts.find(s => s.id === colId)
    if (!existing) setSorts([...sorts, { id: colId, dir: 'asc' }])
    else if (existing.dir === 'asc') setSorts(sorts.map(s => s.id === colId ? { ...s, dir: 'desc' } : s))
    else setSorts(sorts.filter(s => s.id !== colId))
  }

  const setFilter = (colId: string, value: any) => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      setFilters(filters.filter(f => f.id !== colId))
    } else {
      const existing = filters.find(f => f.id === colId)
      if (existing) setFilters(filters.map(f => f.id === colId ? { ...f, value } : f))
      else setFilters([...filters, { id: colId, type: 'text', operator: 'contains', value, label: '' }])
    }
  }

  const exportToCSV = useCallback(() => {
    const headers = visibleColumns.map(c => c.title).join(',')
    const rows = sorted.map(row =>
      visibleColumns.map(col => `"${formatCellValue(getRowValue(row, col), col)}"`).join(',')
    ).join('\n')
    const blob = new Blob([`\uFEFF${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'export.csv'; a.click()
    URL.revokeObjectURL(url)
  }, [visibleColumns, sorted])

  useImperativeHandle(ref, () => ({
    exportToCSV,
    exportToXLSX: () => { /* xlsx integration */ },
    exportToPDF: () => { /* pdf integration */ },
    print: () => window.print(),
    resetFilters: () => setFilters([]),
    resetSorts: () => setSorts([]),
  }), [exportToCSV, setFilters, setSorts])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4 text-destructive" />
        <p className="font-medium">حدث خطأ في تحميل البيانات</p>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {(bulkActions || savedViews || onExport) && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            {bulkActions}
            {selectedRows && selectedRows.size > 0 && (
              <span className="text-sm text-muted-foreground">{selectedRows.size} محدد</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {savedViews && (
              <div className="relative">
                <button onClick={() => setShowViewMenu(!showViewMenu)} className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground">
                  <Save className="h-4 w-4" />
                </button>
                {showViewMenu && (
                  <div className="absolute left-0 top-full mt-1 w-48 bg-card border rounded-lg shadow-lg z-50 py-1">
                    {savedViews.map(v => (
                      <button key={v.id} onClick={() => { onLoadView?.(v); setShowViewMenu(false) }}
                        className="w-full text-right px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2">
                        <Eye className="h-3.5 w-3.5" /> {v.name}
                      </button>
                    ))}
                    <div className="border-t my-1" />
                    <button className="w-full text-right px-3 py-1.5 text-sm hover:bg-accent">حفظ العرض الحالي</button>
                  </div>
                )}
              </div>
            )}
            <button onClick={() => setShowFilterRow(!showFilterRow)}
              className={cn('p-1.5 hover:bg-accent rounded', showFilterRow && 'bg-accent')}>
              <Filter className="h-4 w-4" />
            </button>
            {groupable && (
              <div className="relative">
                <button className="p-1.5 hover:bg-accent rounded">
                  <Group className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="relative">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-1.5 hover:bg-accent rounded">
                <Download className="h-4 w-4" />
              </button>
              {showExportMenu && (
                <div className="absolute left-0 top-full mt-1 w-40 bg-card border rounded-lg shadow-lg z-50 py-1">
                  <button onClick={() => { exportToCSV(); setShowExportMenu(false) }}
                    className="w-full text-right px-3 py-1.5 text-sm hover:bg-accent">تصدير CSV</button>
                  <button onClick={() => setShowExportMenu(false)}
                    className="w-full text-right px-3 py-1.5 text-sm hover:bg-accent">تصدير Excel</button>
                  <button onClick={() => setShowExportMenu(false)}
                    className="w-full text-right px-3 py-1.5 text-sm hover:bg-accent">تصدير PDF</button>
                </div>
              )}
            </div>
            <button onClick={() => window.print()} className="p-1.5 hover:bg-accent rounded">
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto relative">
        <table className="w-full text-sm">
          <thead>
            {stickyHeader && <thead className="sticky top-0 z-10" />}
            <tr className="border-b bg-muted/50">
              {selectable && (
                <th className="w-10 px-2 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRows?.size === paged.length && paged.length > 0}
                    onChange={() => {
                      if (!selectedRows || !onSelectionChange) return
                      if (selectedRows.size === paged.length) onSelectionChange(new Set())
                      else onSelectionChange(new Set(paged.map(r => rowKey(r))))
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
              )}
              {visibleColumns.map(col => (
                <th
                  key={col.id}
                  className={cn(
                    'px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap select-none',
                    col.sortable && sortable && 'cursor-pointer hover:text-foreground',
                  )}
                  style={{ width: col.width, minWidth: col.minWidth, textAlign: col.align }}
                  onMouseEnter={() => setHoveredColumn(col.id)}
                  onMouseLeave={() => setHoveredColumn(null)}
                  onClick={() => col.sortable && sortable && toggleSort(col.id)}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1">{col.title}</span>
                    {col.sortable && sortable && (
                      <span className="flex flex-col">
                        {sorts.find(s => s.id === col.id)?.dir === 'asc'
                          ? <ArrowUp className="h-3 w-3 text-primary" />
                          : sorts.find(s => s.id === col.id)?.dir === 'desc'
                            ? <ArrowDown className="h-3 w-3 text-primary" />
                            : <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                        }
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {rowActions && <th className="w-12 px-2 py-3" />}
            </tr>

            {showFilterRow && (
              <tr className="border-b bg-muted/20">
                {selectable && <th className="w-10 px-2" />}
                {visibleColumns.map(col => (
                  <th key={`filter-${col.id}`} className="px-2 py-1.5">
                    {col.filterable !== false && (
                      <input
                        placeholder={`بحث ${col.title}`}
                        value={filters.find(f => f.id === col.id)?.value ?? ''}
                        onChange={e => setFilter(col.id, e.target.value)}
                        className="w-full h-8 px-2 text-xs bg-background border rounded outline-none focus:ring-1 focus:ring-primary/20"
                      />
                    )}
                  </th>
                ))}
                {rowActions && <th className="w-12" />}
              </tr>
            )}
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}>
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="mr-3 text-sm text-muted-foreground">جاري التحميل...</span>
                  </div>
                </td>
              </tr>
            )}

            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}>
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-3 opacity-50" />
                    <p className="font-medium">لا توجد بيانات</p>
                    {emptyState || <p className="text-sm">لم يتم العثور على سجلات</p>}
                  </div>
                </td>
              </tr>
            )}

            {!loading && groupBy && Object.entries(grouped).length <= 1 && paged.map((row, idx) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  'border-b hover:bg-accent/30 transition-colors cursor-pointer',
                  selectedRows?.has(rowKey(row)) && 'bg-primary/5'
                )}
                onClick={() => onRowClick?.(row)}
                onDoubleClick={() => onRowDoubleClick?.(row)}
              >
                {selectable && (
                  <td className="w-10 px-2 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedRows?.has(rowKey(row)) ?? false}
                      onChange={() => {
                        if (!selectedRows || !onSelectionChange) return
                        const next = new Set(selectedRows)
                        if (next.has(rowKey(row))) next.delete(rowKey(row))
                        else next.add(rowKey(row))
                        onSelectionChange(next)
                      }}
                      className="rounded border-gray-300"
                    />
                  </td>
                )}
                {visibleColumns.map(col => (
                  <td
                    key={col.id}
                    className="px-4 py-3"
                    style={{ textAlign: col.align }}
                  >
                    {col.render
                      ? col.render(getRowValue(row, col), row, idx)
                      : <span className={cn(col.dataType === 'currency' && 'font-mono tabular-nums', col.dataType === 'number' && 'tabular-nums')}>
                          {formatCellValue(getRowValue(row, col), col)}
                        </span>
                    }
                  </td>
                ))}
                {rowActions && (
                  <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            ))}

            {!loading && groupBy && Object.entries(grouped).length > 1 && Object.entries(grouped).map(([groupKey, rows]) => {
              const isExpanded = expandedGroups.has(groupKey)
              if (rows.length === 0) return null
              return (
                <tbody key={groupKey}>
                  <tr className="bg-muted/20 border-b">
                    <td colSpan={visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                      className="px-4 py-2">
                      <button
                        onClick={() => {
                          const next = new Set(expandedGroups)
                          if (next.has(groupKey)) next.delete(groupKey)
                          else next.add(groupKey)
                          setExpandedGroups(next)
                        }}
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        <span>{groupKey || '(بدون تصنيف)'}</span>
                        <span className="text-xs text-muted-foreground">({rows.length})</span>
                      </button>
                    </td>
                  </tr>
                  {isExpanded && paged.filter(r => rows.includes(r)).map(row => (
                    <tr key={rowKey(row)}
                      className="border-b hover:bg-accent/30 transition-colors"
                      onClick={() => onRowClick?.(row)}>
                      {selectable && <td className="w-10 px-2 py-3"><input type="checkbox" /></td>}
                      {visibleColumns.map(col => (
                        <td key={col.id} className="px-4 py-3">
                          {col.render
                            ? col.render(getRowValue(row, col), row, 0)
                            : <span>{formatCellValue(getRowValue(row, col), col)}</span>
                          }
                        </td>
                      ))}
                      {rowActions && <td className="px-2 py-3">{rowActions(row)}</td>}
                    </tr>
                  ))}
                </tbody>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {totalFiltered > 0
              ? `عرض ${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, totalFiltered)} من ${totalFiltered}`
              : 'لا توجد نتائج'
            }
          </span>
          <select
            value={pagination.pageSize}
            onChange={e => setPagination({ ...pagination, pageSize: Number(e.target.value), page: 1 })}
            className="h-7 px-2 text-xs bg-background border rounded outline-none"
          >
            {DEFAULT_PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            disabled={pagination.page <= 1}
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
            className="p-1 hover:bg-accent rounded disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number
            if (totalPages <= 7) pageNum = i + 1
            else if (pagination.page <= 4) pageNum = i + 1
            else if (pagination.page >= totalPages - 3) pageNum = totalPages - 6 + i
            else pageNum = pagination.page - 3 + i
            return (
              <button
                key={pageNum}
                onClick={() => setPagination({ ...pagination, page: pageNum })}
                className={cn(
                  'min-w-[28px] h-7 text-xs rounded',
                  pagination.page === pageNum ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                )}
              >
                {pageNum}
              </button>
            )
          })}

          <button
            disabled={pagination.page >= totalPages}
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
            className="p-1 hover:bg-accent rounded disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export const EnterpriseDataGrid = forwardRef(DataGridInner) as <T extends Record<string, any>>(
  props: DataGridProps<T> & { ref?: React.Ref<DataGridHandlers> }
) => React.ReactElement
