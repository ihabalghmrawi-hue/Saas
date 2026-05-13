'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Package, Box, Warehouse, Truck, BarChart3, Search,
  Filter, ArrowUpDown, Plus, Download, CheckCircle2, XCircle,
  AlertTriangle, Eye, Clock, User, FileText, ArrowLeftRight,
  Sparkles, Shield, Activity, TrendingUp, TrendingDown, MapPin,
  Hash, Scale, QrCode, Grid3X3, LayoutGrid, Layers, Zap,
  ChevronLeft, ChevronRight, Circle, CircleDot,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { WorkbenchShell } from '@/components/workbench/WorkbenchShell'
import { RealtimeValidationBar } from '@/components/workbench/RealtimeValidationBar'
import { AIAssistancePanel } from '@/components/workbench/AIAssistancePanel'
import { AuditOverlay } from '@/components/workbench/AuditOverlay'
import { OperationalCommenting } from '@/components/workbench/OperationalCommenting'
import { CrossEntityInspector } from '@/components/workbench/CrossEntityInspector'
import { WorkbenchMetricCard } from '@/components/workbench/WorkbenchMetricCard'
import { generateMockInventoryItems, generateMockStockMovements, generateMockWarehouseTransfers } from '@/lib/workbench/mock-data'
import type { InventoryItem, ValidationMessage, AIInsight, WorkbenchMetric, InspectorTab } from '@/lib/workbench/types'

const warehouseNames = [
  'المستودع الرئيسي',
  'مستودع المواد الخام',
  'مستودع المواد الكيميائية',
  'مستودع التعبئة',
  'مستودع الصيانة',
]

const itemNames = [
  'مواد خام أ', 'مواد خام ب', 'عبوات كرتون', 'أكياس بلاستيك',
  'قطع غيار م أ', 'زيوت تشحيم', 'مذيبات كيميائية', 'فلاتر تهوية',
  'أحزمة نقل', 'صمامات تحكم', 'مواسير صلب', 'كوابل كهربائية',
  'مفاتيح كهربائية', 'محولات طاقة', 'مراوح تهوية', 'أجهزة قياس',
  'دهانات صناعية', 'مواد تنظيف', 'قفازات واقية', 'أحذية سلامة',
  'خوذ أمان', 'نظارات واقية', 'معدات لحام', 'أدوات يدوية', 'معدات قياس',
]

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'مواد خام': Package,
  'تعبئة وتغليف': Box,
  'قطع غيار': Tool,
  'كيميائيات': Flask,
  'كهربائيات': Zap,
  'معدات سلامة': Shield,
  'أدوات قياس': Activity,
  'معدات صناعية': Truck,
}

function Tool(props: { className?: string }) {
  return <Wrench className={props?.className ?? ''} />
}
function Flask(props: { className?: string }) {
  return <FlaskIcon className={props?.className ?? ''} />
}
function Wrench(props: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props?.className ?? ''}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
}
function FlaskIcon(props: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props?.className ?? ''}><path d="M9 3h6v5l4 11H5l4-11V3z"/><path d="M9 3h6"/></svg>
}

const employeeNames = [
  'أحمد محمد', 'سارة خالد', 'فهد العتيبي', 'نورة عبدالله',
  'ماجد الحربي', 'ريم الشهري', 'خالد القحطاني',
]

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(daysAgo: number): number {
  return randomInt(Date.now() - daysAgo * 86400000, Date.now())
}

interface BinItem {
  id: string
  name: string
  sku: string
  quantity: number
  unit: string
  category: string
}

interface WarehouseBin {
  id: string
  code: string
  capacity: number
  utilization: number
  zone: string
  items: BinItem[]
  lastCounted: number
  status: 'available' | 'partial' | 'full' | 'overfull'
}

interface WarehouseData {
  id: string
  name: string
  totalLocations: number
  itemsInStock: number
  lowItems: number
  todayOps: number
  bins: WarehouseBin[]
}

function generateBinItems(): BinItem[] {
  const count = randomInt(1, 4)
  return Array.from({ length: count }, () => ({
    id: generateId('binitem'),
    name: randomChoice(itemNames),
    sku: `SKU-${String(randomInt(1, 999)).padStart(4, '0')}`,
    quantity: randomInt(1, 200),
    unit: 'قطعة',
    category: randomChoice(['مواد خام', 'تعبئة وتغليف', 'قطع غيار', 'كيميائيات', 'كهربائيات', 'معدات سلامة']),
  }))
}

function generateWarehouse(index: number): WarehouseData {
  const bins: WarehouseBin[] = Array.from({ length: 16 + randomInt(0, 8) }, (_, bi) => {
    const capacity = randomInt(50, 200)
    const items = generateBinItems()
    const totalItems = items.reduce((s, i) => s + i.quantity, 0)
    const utilization = Math.min(100, Math.round((totalItems / capacity) * 100))
    let status: WarehouseBin['status']
    if (utilization >= 95) status = 'overfull'
    else if (utilization >= 75) status = 'full'
    else if (utilization >= 25) status = 'partial'
    else status = 'available'

    return {
      id: generateId('bin'),
      code: `${String(index + 1).padStart(2, '0')}-${String(bi + 1).padStart(3, '0')}`,
      capacity,
      utilization,
      zone: randomChoice(['A', 'B', 'C', 'D']),
      items,
      lastCounted: randomDate(60),
      status,
    }
  })

  const totalItems = bins.reduce((s, b) => s + b.items.reduce((si, i) => si + i.quantity, 0), 0)
  return {
    id: generateId('wh'),
    name: warehouseNames[index] ?? warehouseNames[0],
    totalLocations: bins.length,
    itemsInStock: totalItems,
    lowItems: bins.filter((b) => b.utilization < 20).length,
    todayOps: randomInt(5, 50),
    bins,
  }
}

function generateWarehouses(): WarehouseData[] {
  return warehouseNames.map((_, i) => generateWarehouse(i))
}

const statusColors: Record<string, string> = {
  available: 'bg-green-100 border-green-300 text-green-700',
  partial: 'bg-amber-100 border-amber-300 text-amber-700',
  full: 'bg-orange-100 border-orange-300 text-orange-700',
  overfull: 'bg-red-100 border-red-300 text-red-700',
}

const statusBarColors: Record<string, string> = {
  available: 'bg-green-500',
  partial: 'bg-amber-500',
  full: 'bg-orange-500',
  overfull: 'bg-red-500',
}

function formatDate(date: number): string {
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatTime(date: number): string {
  return new Date(date).toLocaleTimeString('ar-SA', {
    hour: '2-digit', minute: '2-digit',
  })
}

export function WarehouseOperationsConsole() {
  const [warehouses] = useState<WarehouseData[]>(() => generateWarehouses())
  const [activeWhIndex, setActiveWhIndex] = useState(0)
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [zoneFilter, setZoneFilter] = useState<string>('الكل')
  const [auditOpen, setAuditOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('info')

  const activeWarehouse = warehouses[activeWhIndex]
  const selectedBin = useMemo(() => {
    if (!selectedBinId || !activeWarehouse) return null
    return activeWarehouse.bins.find((b) => b.id === selectedBinId) ?? null
  }, [selectedBinId, activeWarehouse])

  const filteredBins = useMemo(() => {
    if (!activeWarehouse) return []
    let result = activeWarehouse.bins
    if (zoneFilter !== 'الكل') {
      result = result.filter((b) => b.zone === zoneFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (b) =>
          b.code.toLowerCase().includes(q) ||
          b.items.some((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)),
      )
    }
    return result
  }, [activeWarehouse, zoneFilter, searchQuery])

  const metrics: WorkbenchMetric[] = useMemo(() => {
    const totalLocations = warehouses.reduce((s, w) => s + w.totalLocations, 0)
    const totalItems = warehouses.reduce((s, w) => s + w.itemsInStock, 0)
    const totalLow = warehouses.reduce((s, w) => s + w.lowItems, 0)
    const totalOps = warehouses.reduce((s, w) => s + w.todayOps, 0)
    return [
      { id: 'locs', label: 'إجمالي المواقع', value: totalLocations, icon: 'Package', severity: 'info' },
      { id: 'items', label: 'العناصر في المخزون', value: totalItems.toLocaleString('ar-SA'), icon: 'Package', severity: 'success', change: 5, trend: 'up' },
      { id: 'low', label: 'عناصر منخفضة', value: totalLow, icon: 'Package', severity: totalLow > 10 ? 'warning' : 'info' },
      { id: 'ops', label: 'عمليات اليوم', value: totalOps, icon: 'Package', severity: 'info', change: 12, trend: 'up' },
    ]
  }, [warehouses])

  const allValidationMessages: ValidationMessage[] = useMemo(() => {
    const msgs: ValidationMessage[] = []
    for (const wh of warehouses) {
      for (const bin of wh.bins) {
        if (bin.status === 'overfull') {
          msgs.push({ id: generateId('msg'), type: 'error', message: `الموقع ${bin.code} تجاوز السعة القصوى`, field: bin.code })
        } else if (bin.status === 'full') {
          msgs.push({ id: generateId('msg'), type: 'warning', message: `الموقع ${bin.code} يقترب من السعة القصوى`, field: bin.code })
        }
      }
    }
    return msgs.slice(0, 8)
  }, [warehouses])

  const inspectorTabs: InspectorTab[] = [
    { id: 'info', label: 'تفاصيل الموقع', icon: 'info' },
    { id: 'items', label: 'العناصر', icon: 'activity' },
    { id: 'history', label: 'السجل', icon: 'file' },
  ]

  const zones = useMemo(() => {
    if (!activeWarehouse) return []
    const z = new Set(activeWarehouse.bins.map((b) => b.zone))
    return ['الكل', ...Array.from(z)]
  }, [activeWarehouse])

  const utilizationSummary = useMemo(() => {
    if (!activeWarehouse) return { avg: 0, available: 0, partial: 0, full: 0, overfull: 0 }
    const bins = activeWarehouse.bins
    const avg = Math.round(bins.reduce((s, b) => s + b.utilization, 0) / bins.length)
    return {
      avg,
      available: bins.filter((b) => b.status === 'available').length,
      partial: bins.filter((b) => b.status === 'partial').length,
      full: bins.filter((b) => b.status === 'full').length,
      overfull: bins.filter((b) => b.status === 'overfull').length,
    }
  }, [activeWarehouse])

  return (
    <WorkbenchShell
      title="كونسول عمليات المستودع"
      breadcrumbs={[
        { label: 'المخزون' },
        { label: 'عمليات المستودع' },
      ]}
      metrics={metrics}
      sidebar={
        <div className="flex flex-col h-full">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في المواقع..."
                className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="flex gap-1 p-3 border-b overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {zones.map((zone) => (
              <button
                key={zone}
                type="button"
                onClick={() => setZoneFilter(zone)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors',
                  zoneFilter === zone
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                المنطقة {zone}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-4 gap-2">
              {filteredBins.map((bin) => {
                const isSelected = bin.id === selectedBinId
                const colorClass = statusColors[bin.status]
                return (
                  <button
                    key={bin.id}
                    type="button"
                    onClick={() => setSelectedBinId(bin.id)}
                    className={cn(
                      'flex flex-col items-center justify-center p-2 rounded-lg border-2 text-center transition-all',
                      colorClass,
                      isSelected && 'ring-2 ring-primary ring-offset-1',
                    )}
                  >
                    <span className="text-[10px] font-bold">{bin.code}</span>
                    <span className="text-[10px] opacity-75">{bin.utilization}%</span>
                    <div className="w-full h-1 bg-white/50 rounded-full mt-1 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', statusBarColors[bin.status])}
                        style={{ width: `${bin.utilization}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-3 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{filteredBins.length} موقع</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                  {utilizationSummary.available}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                  {utilizationSummary.partial}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
                  {utilizationSummary.full}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                  {utilizationSummary.overfull}
                </span>
              </div>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden flex">
              <div className="bg-green-500 h-full" style={{ width: `${(utilizationSummary.available / filteredBins.length) * 100}%` }} />
              <div className="bg-amber-500 h-full" style={{ width: `${(utilizationSummary.partial / filteredBins.length) * 100}%` }} />
              <div className="bg-orange-500 h-full" style={{ width: `${(utilizationSummary.full / filteredBins.length) * 100}%` }} />
              <div className="bg-red-500 h-full" style={{ width: `${(utilizationSummary.overfull / filteredBins.length) * 100}%` }} />
            </div>
          </div>
        </div>
      }
      sidebarWidth={420}
      actions={[
        { id: 'new', label: 'جرد موقع', type: 'primary', handler: () => {} },
        { id: 'transfer', label: 'نقل موقع', type: 'secondary', handler: () => {} },
        { id: 'export', label: 'تصدير', type: 'ghost', handler: () => {} },
        { id: 'audit', label: 'سجل التدقيق', type: 'ghost', handler: () => setAuditOpen(!auditOpen) },
        { id: 'ai', label: 'تحليل ذكي', type: 'ghost', handler: () => setAiOpen(!aiOpen) },
      ]}
      inspectorTabs={inspectorTabs}
      inspectorOpen={inspectorOpen}
      onInspectorToggle={setInspectorOpen}
      inspectorTab={inspectorTab}
      onInspectorTabChange={setInspectorTab}
      inspectorContent={
        <>
          {selectedBin ? (
            <>
              {inspectorTab === 'info' && (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-card p-4">
                    <h4 className="text-sm font-semibold mb-3">معلومات الموقع</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">رمز الموقع</span>
                        <span className="text-sm font-medium">{selectedBin.code}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">المنطقة</span>
                        <span className="text-sm font-medium">{selectedBin.zone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">السعة القصوى</span>
                        <span className="text-sm font-medium">{selectedBin.capacity} وحدة</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">نسبة الاستخدام</span>
                        <span className="text-sm font-medium" dir="ltr">{selectedBin.utilization}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">آخر جرد</span>
                        <span className="text-sm font-medium">{formatDate(selectedBin.lastCounted)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">الحالة</span>
                        <span className={cn('text-xs font-bold px-2 py-0.5 rounded', statusColors[selectedBin.status])}>
                          {selectedBin.status === 'available' ? 'متاح' : selectedBin.status === 'partial' ? 'قيد الاستخدام' : selectedBin.status === 'full' ? 'ممتلئ' : 'ممتلئ عن الحد'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-4">
                    <h4 className="text-sm font-semibold mb-3">إجراءات</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="default" size="sm" className="h-9 text-xs gap-1">
                        <QrCode className="h-3.5 w-3.5" />
                        جرد
                      </Button>
                      <Button variant="secondary" size="sm" className="h-9 text-xs gap-1">
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                        نقل
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 text-xs gap-1">
                        <Package className="h-3.5 w-3.5" />
                        إعادة تخزين
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 text-xs gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        عرض التفاصيل
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-4">
                    <h4 className="text-sm font-semibold mb-3">اقتراحات</h4>
                    <div className="space-y-2">
                      {selectedBin.utilization >= 80 && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 text-blue-700">
                          <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                          <span className="text-xs">نقل بعض العناصر إلى مواقع أقل استخداماً</span>
                        </div>
                      )}
                      {selectedBin.utilization <= 20 && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-green-50 text-green-700">
                          <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                          <span className="text-xs">الموقع متاح لاستقبال عناصر جديدة</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 text-amber-700">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="text-xs">آخر جرد منذ أكثر من 30 يوماً</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === 'items' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">العناصر في الموقع {selectedBin.code}</h4>
                  {selectedBin.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </div>
                      <div className="text-left" dir="ltr">
                        <p className="text-sm font-bold">{item.quantity.toLocaleString('ar-SA')}</p>
                        <p className="text-[10px] text-muted-foreground">{item.unit}</p>
                      </div>
                    </div>
                  ))}
                  {selectedBin.items.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">لا توجد عناصر في هذا الموقع</p>
                  )}
                </div>
              )}

              {inspectorTab === 'history' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">سجل الموقع</h4>
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <div className="p-1.5 rounded-full bg-blue-100">
                        <Activity className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {['إدخال مخزون', 'صرف مخزون', 'جرد', 'نقل', 'تسوية'][i]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {randomChoice(employeeNames)} - {formatDate(randomDate(10))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">اختر موقعاً من الشبكة</p>
            </div>
          )}
        </>
      }
      validationBar={
        <RealtimeValidationBar
          messages={allValidationMessages}
          onDismiss={(id) => {}}
        />
      }
      aiPanel={
        <AIAssistancePanel
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          domain="inventory"
          entityId={activeWarehouse?.id}
        />
      }
    >
      <div className="flex flex-col h-full">
        <div className="flex gap-2 p-4 border-b overflow-x-auto bg-card shrink-0" style={{ scrollbarWidth: 'none' }}>
          {warehouses.map((wh, idx) => (
            <button
              key={wh.id}
              type="button"
              onClick={() => { setActiveWhIndex(idx); setSelectedBinId(null) }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all whitespace-nowrap',
                activeWhIndex === idx
                  ? 'border-primary bg-primary/5 text-primary font-medium shadow-sm'
                  : 'border-border hover:bg-muted/50 text-muted-foreground',
              )}
            >
              <Warehouse className="h-4 w-4" />
              <span className="text-sm">{wh.name}</span>
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full',
                activeWhIndex === idx ? 'bg-primary/10' : 'bg-muted',
              )}>
                {wh.totalLocations}
              </span>
            </button>
          ))}
        </div>

        {activeWarehouse && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">إجمالي المواقع</p>
                <p className="text-2xl font-bold">{activeWarehouse.totalLocations}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">العناصر في المخزون</p>
                <p className="text-2xl font-bold">{activeWarehouse.itemsInStock.toLocaleString('ar-SA')}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">عناصر منخفضة</p>
                <p className="text-2xl font-bold">{activeWarehouse.lowItems}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">عمليات اليوم</p>
                <p className="text-2xl font-bold">{activeWarehouse.todayOps}</p>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4 mb-4">
              <h3 className="text-sm font-semibold mb-3">نظرة عامة على الاستخدام</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-lg font-bold text-green-700">{utilizationSummary.available}</p>
                  <p className="text-xs text-green-600">متاح</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-lg font-bold text-amber-700">{utilizationSummary.partial}</p>
                  <p className="text-xs text-amber-600">قيد الاستخدام</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <p className="text-lg font-bold text-orange-700">{utilizationSummary.full}</p>
                  <p className="text-xs text-orange-600">ممتلئ</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-lg font-bold text-red-700">{utilizationSummary.overfull}</p>
                  <p className="text-xs text-red-600">ممتلئ عن الحد</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">شبكة المواقع - {activeWarehouse.name}</h3>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Grid3X3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Layers className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {filteredBins.map((bin) => {
                  const isSelected = bin.id === selectedBinId
                  const colorClass = statusColors[bin.status]
                  return (
                    <button
                      key={bin.id}
                      type="button"
                      onClick={() => setSelectedBinId(bin.id)}
                      className={cn(
                        'flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all min-h-[90px]',
                        colorClass,
                        isSelected && 'ring-2 ring-primary ring-offset-2 scale-105',
                        'hover:shadow-md',
                      )}
                    >
                      <span className="text-xs font-bold">{bin.code}</span>
                      <div className="flex items-center gap-1 mt-1">
                        <Package className="h-3 w-3 opacity-60" />
                        <span className="text-[10px]">{bin.items.length}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/50 rounded-full mt-2 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', statusBarColors[bin.status])}
                          style={{ width: `${bin.utilization}%` }}
                        />
                      </div>
                      <span className="text-[9px] mt-0.5 opacity-70" dir="ltr">{bin.utilization}%</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <AuditOverlay
        entries={[]}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId={activeWarehouse?.id}
        entityType="عمليات مستودع"
      />
    </WorkbenchShell>
  )
}
