'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Activity, Heart, AlertTriangle, CheckCircle2, Clock, Users, Database, Zap, BarChart3,
  RefreshCw, Search, Filter, HardDrive, Globe, Wifi, XCircle, Info, ChevronDown, ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'

type TenantStatus = 'healthy' | 'warning' | 'critical' | 'offline'
type ServiceName = 'المالية' | 'المخزون' | 'المشتريات' | 'المبيعات' | 'الرواتب'
type ServiceStatus = 'operational' | 'degraded' | 'down' | 'maintenance'

interface ServiceHealth {
  name: ServiceName
  status: ServiceStatus
  latency: number
}

interface WorkflowHealth {
  active: number
  failed: number
  completed: number
}

interface TenantHealth {
  id: string
  name: string
  status: TenantStatus
  activeUsers: number
  apiLatency: number
  errorRate: number
  queueDepth: number
  healthScore: number
  services: ServiceHealth[]
  workflowHealth: WorkflowHealth
  storageUsed: number
  storageLimit: number
  apiRateLimit: number
  apiRateUsed: number
  lastActivity: number
  recentErrors: Array<{ message: string; timestamp: number; severity: 'error' | 'warning' }>
}

const TENANT_NAMES = [
  'شركة الأمل القابضة', 'مؤسسة السلام التجارية', 'مجموعة الخليج المالية',
  'شركة الواحة الصناعية', 'مؤسسة النور للمقاولات', 'شركة الفهد العقارية',
  'الشركة السعودية للخدمات', 'مجموعة الجزيرة الاستثمارية',
]

const SERVICE_NAMES: ServiceName[] = ['المالية', 'المخزون', 'المشتريات', 'المبيعات', 'الرواتب']

function randInt(min: number, max: number): number {
  const seed = Date.now() % 1000
  const pseudo = ((seed * 9301 + 49297) % 233280) / 233280
  return Math.floor(pseudo * (max - min + 1)) + min
}

function generateMockTenants(): TenantHealth[] {
  return TENANT_NAMES.map((name, idx) => {
    const statusRand = idx
    let status: TenantStatus
    let healthScore: number
    let errorRate: number
    let apiLatency: number
    if (statusRand % 4 === 0) {
      status = 'healthy'; healthScore = randInt(85, 99); errorRate = randInt(0, 2); apiLatency = randInt(10, 80)
    } else if (statusRand % 4 === 1) {
      status = 'warning'; healthScore = randInt(65, 84); errorRate = randInt(3, 8); apiLatency = randInt(100, 300)
    } else if (statusRand % 4 === 2) {
      status = 'critical'; healthScore = randInt(35, 64); errorRate = randInt(9, 20); apiLatency = randInt(500, 2000)
    } else {
      status = 'offline'; healthScore = 0; errorRate = 100; apiLatency = 0
    }

    return {
      id: `tenant-${String(idx + 1).padStart(3, '0')}`,
      name,
      status,
      activeUsers: status === 'offline' ? 0 : randInt(5, 150),
      apiLatency,
      errorRate,
      queueDepth: status === 'offline' ? 0 : randInt(0, 50),
      healthScore,
      services: SERVICE_NAMES.map((sname, si) => {
        let svcStatus: ServiceStatus
        if (status === 'offline') {
          svcStatus = 'down'
        } else if (status === 'critical' && si === 0) {
          svcStatus = 'down'
        } else if (status === 'warning' && si < 2) {
          svcStatus = 'degraded'
        } else if (status === 'healthy' && si === 4) {
          svcStatus = 'maintenance'
        } else {
          svcStatus = 'operational'
        }
        return {
          name: sname,
          status: svcStatus,
          latency: svcStatus === 'operational' ? randInt(10, 100) : svcStatus === 'degraded' ? randInt(200, 800) : 0,
        }
      }),
      workflowHealth: {
        active: status === 'offline' ? 0 : randInt(2, 30),
        failed: status === 'offline' ? 0 : randInt(0, 8),
        completed: randInt(50, 500),
      },
      storageUsed: randInt(10, 95),
      storageLimit: 100,
      apiRateLimit: 10000,
      apiRateUsed: randInt(100, 9500),
      lastActivity: Date.now() - (status === 'offline' ? randInt(3600000, 86400000) : randInt(1000, 300000)),
      recentErrors: status === 'offline' ? [
        { message: 'انقطاع الاتصال بالخادم', timestamp: Date.now() - randInt(60000, 3600000), severity: 'error' as const },
        { message: 'فشل جميع محاولات إعادة الاتصال', timestamp: Date.now() - randInt(3600000, 7200000), severity: 'error' as const },
      ] : status === 'critical' ? [
        { message: 'تجاوز حد الذاكرة المسموح', timestamp: Date.now() - randInt(60000, 300000), severity: 'error' as const },
        { message: 'فشل معالجة طلبات API', timestamp: Date.now() - randInt(300000, 600000), severity: 'error' as const },
        { message: 'ارتفاع معدل الأخطاء', timestamp: Date.now() - randInt(600000, 1800000), severity: 'warning' as const },
      ] : status === 'warning' ? [
        { message: 'استخدام المعالج مرتفع (78%)', timestamp: Date.now() - randInt(60000, 600000), severity: 'warning' as const },
        { message: 'زمن استجابة API مرتفع', timestamp: Date.now() - randInt(600000, 1800000), severity: 'warning' as const },
      ] : [
        { message: 'تنبيه صيانة مجدولة', timestamp: Date.now() - randInt(3600000, 7200000), severity: 'warning' as const },
      ],
    }
  })
}

const STATUS_CONFIG: Record<TenantStatus, { label: string; color: string; bg: string; icon: typeof Heart }> = {
  healthy: { label: 'صحي', color: 'text-success', bg: 'bg-success/10', icon: Heart },
  warning: { label: 'تحذير', color: 'text-warning', bg: 'bg-warning/10', icon: AlertTriangle },
  critical: { label: 'حرج', color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle },
  offline: { label: 'غير متصل', color: 'text-muted-foreground', bg: 'bg-muted', icon: Clock },
}

const SERVICE_STATUS_CONFIG: Record<ServiceStatus, { label: string; color: string; bg: string }> = {
  operational: { label: 'يعمل', color: 'text-success', bg: 'bg-success/10' },
  degraded: { label: 'متراجع', color: 'text-warning', bg: 'bg-warning/10' },
  down: { label: 'متوقف', color: 'text-destructive', bg: 'bg-destructive/10' },
  maintenance: { label: 'صيانة', color: 'text-muted-foreground', bg: 'bg-muted' },
}

const STATUS_FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'healthy', label: 'صحي' },
  { value: 'warning', label: 'تحذير' },
  { value: 'critical', label: 'حرج' },
  { value: 'offline', label: 'غير متصل' },
]

function formatBytes(percent: number): string {
  return `${percent}%`
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `منذ ${hours} ساعة`
  return `منذ ${Math.floor(hours / 24)} يوم`
}

export function TenantHealthMonitor() {
  const [tenants, setTenants] = useState<TenantHealth[]>(generateMockTenants)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      setTenants(generateMockTenants())
    }, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const filteredTenants = useMemo(() => {
    let result = [...tenants]
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      )
    }
    return result
  }, [tenants, searchQuery, statusFilter])

  const globalKPIs = useMemo(() => {
    const online = tenants.filter(t => t.status !== 'offline').length
    const totalActiveWfs = tenants.reduce((s, t) => s + t.workflowHealth.active, 0)
    const avgErrorRate = tenants.filter(t => t.status !== 'offline').reduce((s, t) => s + t.errorRate, 0) / Math.max(online, 1)
    const avgLatency = tenants.filter(t => t.status !== 'offline').reduce((s, t) => s + t.apiLatency, 0) / Math.max(online, 1)
    return { online, totalActiveWfs, avgErrorRate: avgErrorRate.toFixed(1), avgLatency: Math.round(avgLatency) }
  }, [tenants])

  function handleRefresh() {
    setRefreshing(true)
    setTenants(generateMockTenants())
    setTimeout(() => setRefreshing(false), 500)
  }

  function toggleExpand(id: string) {
    setExpandedTenant(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">مراقبة صحة المستأجرين</h2>
            <p className="text-sm text-muted-foreground">مؤشرات الأداء والصحة التشغيلية للمستأجرين</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded border-input"
            />
            تحديث تلقائي (30 ثانية)
          </label>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh} loading={refreshing}>
            <RefreshCw className="h-4 w-4" />
            تحديث
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-success/10">
                <Heart className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{globalKPIs.online}/{tenants.length}</p>
                <p className="text-xs text-muted-foreground">مستأجرون متصلون</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-blue-50">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{globalKPIs.totalActiveWfs}</p>
                <p className="text-xs text-muted-foreground">سير عمل نشط</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('rounded-lg p-2', parseFloat(globalKPIs.avgErrorRate) > 5 ? 'bg-destructive/10' : 'bg-muted')}>
                <AlertTriangle className={cn('h-5 w-5', parseFloat(globalKPIs.avgErrorRate) > 5 ? 'text-destructive' : 'text-muted-foreground')} />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{globalKPIs.avgErrorRate}%</p>
                <p className="text-xs text-muted-foreground">متوسط نسبة الأخطاء</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('rounded-lg p-2', globalKPIs.avgLatency > 200 ? 'bg-warning/10' : 'bg-muted')}>
                <Activity className={cn('h-5 w-5', globalKPIs.avgLatency > 200 ? 'text-warning' : 'text-muted-foreground')} />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{globalKPIs.avgLatency}ms</p>
                <p className="text-xs text-muted-foreground">متوسط زمن الاستجابة</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث عن مستأجر..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          options={STATUS_FILTERS}
          className="w-40"
        />
      </div>

      {filteredTenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Search className="h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">لا توجد نتائج</h3>
          <p className="text-sm text-muted-foreground">لم يتم العثور على مستأجرين مطابقين لمعايير البحث</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTenants.map(tenant => {
            const statusCfg = STATUS_CONFIG[tenant.status]
            const StatusIcon = statusCfg.icon
            return (
              <Card key={tenant.id}>
                <CardContent className="p-0">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleExpand(tenant.id)}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className={cn('rounded-lg p-2', statusCfg.bg)}>
                        <StatusIcon className={cn('h-5 w-5', statusCfg.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{tenant.name}</span>
                          <Badge variant="outline" className={cn('text-xs', statusCfg.color, statusCfg.bg)}>
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {tenant.activeUsers} مستخدم
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {tenant.apiLatency}ms
                          </span>
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {tenant.errorRate}% أخطاء
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(tenant.lastActivity)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center">
                        <div className="relative h-10 w-10">
                          <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-muted" strokeWidth="3" />
                            <circle
                              cx="18" cy="18" r="15.5" fill="none"
                              className={cn(
                                'transition-all duration-500',
                                tenant.healthScore >= 80 ? 'stroke-success' :
                                tenant.healthScore >= 50 ? 'stroke-warning' :
                                'stroke-destructive'
                              )}
                              strokeWidth="3"
                              strokeDasharray={`${tenant.healthScore * 0.97} 100`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className={cn(
                            'absolute inset-0 flex items-center justify-center text-[10px] font-bold',
                            tenant.healthScore >= 80 ? 'text-success' :
                            tenant.healthScore >= 50 ? 'text-warning' :
                            'text-destructive'
                          )}>
                            {tenant.healthScore}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">صحة</p>
                      </div>
                      <Button variant="ghost" size="icon" className="rounded-full">
                        {expandedTenant === tenant.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {expandedTenant === tenant.id && (
                    <div className="border-t px-4 py-4 space-y-5 animate-fade-in">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">حالة الخدمات</h4>
                          <div className="space-y-2">
                            {tenant.services.map(svc => {
                              const svcCfg = SERVICE_STATUS_CONFIG[svc.status]
                              return (
                                <div key={svc.name} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/30">
                                  <div className="flex items-center gap-2">
                                    <div className={cn('w-2 h-2 rounded-full', svcCfg.bg.replace('/10', '/80'))} />
                                    <span className="text-sm">{svc.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={cn('text-xs', svcCfg.color)}>{svcCfg.label}</span>
                                    {svc.status !== 'down' && svc.status !== 'maintenance' && (
                                      <span className="text-[10px] text-muted-foreground">{svc.latency}ms</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">صحة سير العمل</h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between px-2">
                              <span className="text-sm text-muted-foreground">نشط</span>
                              <span className="text-sm font-medium tabular-nums text-foreground">{tenant.workflowHealth.active}</span>
                            </div>
                            <div className="flex items-center justify-between px-2">
                              <span className="text-sm text-muted-foreground">فاشل</span>
                              <span className="text-sm font-medium tabular-nums text-destructive">{tenant.workflowHealth.failed}</span>
                            </div>
                            <div className="flex items-center justify-between px-2">
                              <span className="text-sm text-muted-foreground">مكتمل</span>
                              <span className="text-sm font-medium tabular-nums text-success">{tenant.workflowHealth.completed}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">الموارد</h4>
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between text-sm mb-1 px-2">
                                <span className="text-muted-foreground">مساحة التخزين</span>
                                <span className="tabular-nums">{formatBytes(tenant.storageUsed)}</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden mx-2">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    tenant.storageUsed > 90 ? 'bg-destructive' :
                                    tenant.storageUsed > 70 ? 'bg-warning' : 'bg-success'
                                  )}
                                  style={{ width: `${tenant.storageUsed}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-sm mb-1 px-2">
                                <span className="text-muted-foreground">حدود API</span>
                                <span className="tabular-nums">{Math.round(tenant.apiRateUsed / tenant.apiRateLimit * 100)}%</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden mx-2">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    tenant.apiRateUsed / tenant.apiRateLimit > 0.9 ? 'bg-destructive' :
                                    tenant.apiRateUsed / tenant.apiRateLimit > 0.7 ? 'bg-warning' : 'bg-primary'
                                  )}
                                  style={{ width: `${tenant.apiRateUsed / tenant.apiRateLimit * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {tenant.recentErrors.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">الأخطاء والتحذيرات الأخيرة</h4>
                          <div className="space-y-1.5">
                            {tenant.recentErrors.map((err, idx) => (
                              <div key={idx} className={cn(
                                'flex items-start gap-2 p-2 rounded-lg text-sm',
                                err.severity === 'error' ? 'bg-destructive/5' : 'bg-warning/5'
                              )}>
                                {err.severity === 'error' ? (
                                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                                )}
                                <span className="flex-1 text-foreground">{err.message}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{formatTime(err.timestamp)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            المعرف: {tenant.id}
                          </span>
                          <span className="flex items-center gap-1">
                            <Wifi className="h-3 w-3" />
                            عمق الطابور: {tenant.queueDepth}
                          </span>
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            آخر نشاط: {formatTime(tenant.lastActivity)}
                          </span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => toggleExpand(tenant.id)}>
                          طي
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
