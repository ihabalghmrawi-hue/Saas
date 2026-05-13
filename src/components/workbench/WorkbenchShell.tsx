'use client'

import { useState, useMemo, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, PanelLeft, PanelRight, PanelBottom,
  Search, Filter, ArrowUpDown, Maximize2, Minimize2,
  RefreshCw, Settings, Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { WorkbenchMetricCard } from './WorkbenchMetricCard'
import type { WorkbenchMetric, WorkbenchAction, InspectorTab } from '@/lib/workbench/types'

export interface WorkbenchShellProps {
  title: string
  description?: string
  breadcrumbs: { label: string; icon?: any }[]
  metrics: WorkbenchMetric[]
  actions?: WorkbenchAction[]
  inspectorTabs?: InspectorTab[]
  inspectorContent?: ReactNode
  inspectorOpen?: boolean
  onInspectorToggle?: (open: boolean) => void
  inspectorTab?: string
  onInspectorTabChange?: (tab: string) => void
  children?: ReactNode
  sidebar?: ReactNode
  sidebarWidth?: number
  className?: string
  validationBar?: ReactNode
  aiPanel?: ReactNode
}

export function WorkbenchShell({
  title,
  description,
  breadcrumbs,
  metrics,
  actions,
  inspectorTabs,
  inspectorContent,
  inspectorOpen: externalInspectorOpen,
  onInspectorToggle,
  inspectorTab: externalInspectorTab,
  onInspectorTabChange,
  children,
  sidebar,
  sidebarWidth = 280,
  className,
  validationBar,
  aiPanel,
}: WorkbenchShellProps) {
  const [internalInspectorOpen, setInternalInspectorOpen] = useState(true)
  const [internalInspectorTab, setInternalInspectorTab] = useState('info')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'split'>('list')

  const inspectorOpen = externalInspectorOpen ?? internalInspectorOpen
  const inspectorTab = externalInspectorTab ?? internalInspectorTab

  const handleInspectorToggle = () => {
    const next = !inspectorOpen
    if (onInspectorToggle) {
      onInspectorToggle(next)
    } else {
      setInternalInspectorOpen(next)
    }
  }

  const handleInspectorTabChange = (tab: string) => {
    if (onInspectorTabChange) {
      onInspectorTabChange(tab)
    } else {
      setInternalInspectorTab(tab)
    }
  }

  const hasInspector = inspectorTabs && inspectorTabs.length > 0

  return (
    <div className={cn('flex flex-col h-full bg-background', className)} dir="rtl">
      <div className="border-b bg-card shrink-0">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <EnterpriseBreadcrumbs
              items={breadcrumbs.map((crumb) => ({
                label: crumb.label,
                icon: crumb.icon,
              }))}
            />
          </div>
          <div className="flex items-center gap-1">
            {actions?.map((action) => (
              <Button
                key={action.id}
                variant={action.type === 'danger' ? 'destructive' : action.type === 'primary' ? 'default' : action.type === 'secondary' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={action.handler}
                className="h-9 text-xs gap-1"
                title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
              >
                {action.label}
              </Button>
            ))}
            <div className="w-px h-6 bg-border mx-1" />
            <Button variant="ghost" size="icon" className="h-9 w-9" title="بحث">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" title="تصفية">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" title="ترتيب">
              <ArrowUpDown className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9', sidebarOpen && 'text-primary')}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'إخفاء الشريط الجانبي' : 'إظهار الشريط الجانبي'}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9', inspectorOpen && 'text-primary')}
              onClick={handleInspectorToggle}
              title={inspectorOpen ? 'إخفاء لوحة التفاصيل' : 'إظهار لوحة التفاصيل'}
            >
              <PanelRight className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <div className="flex items-center border rounded-lg p-0.5">
              {(['list', 'detail', 'split'] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setViewMode(mode)}
                  title={mode === 'list' ? 'عرض القائمة' : mode === 'detail' ? 'عرض التفاصيل' : 'عرض مقسم'}
                >
                  {mode === 'list' ? <LayoutDashboard className="h-3.5 w-3.5" /> :
                   mode === 'detail' ? <Maximize2 className="h-3.5 w-3.5" /> :
                   <Minimize2 className="h-3.5 w-3.5" />}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 pb-1">
          <h1 className="text-xl font-bold">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>

      {metrics.length > 0 && (
        <div className="border-b bg-muted/20 shrink-0">
          <div className="flex gap-3 px-6 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {metrics.map((metric) => (
              <WorkbenchMetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {sidebar && (
          <div
            className={cn(
              'border-l overflow-y-auto shrink-0 transition-all duration-300',
              sidebarOpen ? 'opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0',
            )}
            style={{ width: sidebarOpen ? sidebarWidth : 0, minWidth: sidebarOpen ? sidebarWidth : 0 }}
          >
            {sidebar}
          </div>
        )}

        <div className={cn(
          'flex-1 overflow-y-auto transition-all duration-300',
          viewMode === 'split' && 'border-l',
        )}>
          {children}
        </div>

        {hasInspector && inspectorContent && (
          <div
            className={cn(
              'border-r overflow-hidden shrink-0 transition-all duration-300',
              inspectorOpen ? 'opacity-100' : 'w-0 opacity-0 border-r-0',
            )}
            style={{ width: inspectorOpen ? 480 : 0, minWidth: inspectorOpen ? 480 : 0 }}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b shrink-0">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={handleInspectorToggle} className="h-8 w-8">
                    <PanelRight className="h-4 w-4" />
                  </Button>
                  <h3 className="font-semibold text-sm">التفاصيل</h3>
                </div>
              </div>
              {inspectorTabs && inspectorTabs.length > 0 && (
                <div className="flex border-b shrink-0 overflow-x-auto">
                  {inspectorTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleInspectorTabChange(tab.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap',
                        'border-b-2 transition-colors',
                        tab.id === inspectorTab
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <span>{tab.label}</span>
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span className="flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4">
                {inspectorContent}
              </div>
            </div>
          </div>
        )}
      </div>

      {validationBar && (
        <div className="shrink-0">
          {validationBar}
        </div>
      )}

      {aiPanel}
    </div>
  )
}
