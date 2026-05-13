'use client'

import { useState } from 'react'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, PieChart,
  Activity, ArrowUpRight, ArrowDownRight, Users, ShoppingCart,
  Package, Wallet, Download, Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const KPI_DATA = [
  { label: 'صافي الربح', value: 530000, prevValue: 392000, change: 35.2, format: 'currency', trend: 'up' },
  { label: 'الإيرادات', value: 3500000, prevValue: 3125000, change: 12.0, format: 'currency', trend: 'up' },
  { label: 'المصروفات', value: 2970000, prevValue: 2733000, change: 8.7, format: 'currency', trend: 'up' },
  { label: 'هامش الربح', value: 15.1, prevValue: 12.5, change: 2.6, format: 'percent', trend: 'up' },
  { label: 'السيولة', value: 2.1, prevValue: 1.8, change: 16.7, format: 'ratio', trend: 'up' },
  { label: 'المبيعات (عدد)', value: 342, prevValue: 298, change: 14.8, format: 'number', trend: 'up' },
]

const SECTION_KPIS = [
  { section: 'المالية', icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50',
    items: [
      { label: 'إيرادات اليوم', value: 125000, change: '+8%', trend: 'up' },
      { label: 'المصروفات', value: 87500, change: '-3%', trend: 'down' },
      { label: 'الذمم المدينة', value: 680000, change: '+5%', trend: 'up' },
      { label: 'الذمم الدائنة', value: 340000, change: '-2%', trend: 'down' },
    ]},
  { section: 'المبيعات', icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-50',
    items: [
      { label: 'فواتير اليوم', value: 28, change: '+12%', trend: 'up' },
      { label: 'متوسط الفاتورة', value: 12500, change: '+4%', trend: 'up' },
      { label: 'العملاء الجدد', value: 5, change: '+25%', trend: 'up' },
      { label: 'نسبة التحويل', value: '68%', change: '+3%', trend: 'up' },
    ]},
  { section: 'المخزون', icon: Package, color: 'text-orange-600', bg: 'bg-orange-50',
    items: [
      { label: 'قيمة المخزون', value: 920000, change: '-2%', trend: 'down' },
      { label: 'دوران المخزون', value: '6.2', change: '+8%', trend: 'up' },
      { label: 'منتجات ناقصة', value: 12, change: '-15%', trend: 'down' },
      { label: 'طلبات شراء', value: 8, change: '+33%', trend: 'up' },
    ]},
]

const RECENT_ALERTS = [
  { type: 'warning', message: 'رصيد الصندوق أقل من الحد الأدنى', time: 'قبل 10 دقائق' },
  { type: 'info', message: 'تم ترحيل 3 قيود يومية جديدة', time: 'قبل 25 دقيقة' },
  { type: 'success', message: 'اكتملت تسوية بنك الراجحي', time: 'قبل ساعة' },
  { type: 'critical', message: 'تجاوز حد ائتماني لعميل', time: 'قبل ساعتين' },
]

export function CEODashboard() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b bg-card">
        <EnterpriseBreadcrumbs items={[{ label: 'التقارير التنفيذية', icon: BarChart3 }, { label: 'لوحة الرئيس التنفيذي' }]} />
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold">لوحة الرئيس التنفيذي</h1>
            <p className="text-sm text-muted-foreground">نظرة شاملة على أداء الشركة</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"><Calendar className="h-4 w-4 ml-1" /> يناير 2024</Button>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 ml-1" /> تصدير</Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Top KPI Row */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
          {KPI_DATA.map(kpi => (
            <Card key={kpi.label} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{kpi.label}</div>
                <div className="text-xl font-bold mt-1">
                  {kpi.format === 'currency'
                    ? `${(kpi.value / 1000).toFixed(1)}K`
                    : kpi.format === 'percent'
                      ? `${kpi.value}%`
                      : kpi.value.toLocaleString('ar-SA')
                  }
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {kpi.trend === 'up'
                    ? <ArrowUpRight className="h-3 w-3 text-success" />
                    : <ArrowDownRight className="h-3 w-3 text-destructive" />
                  }
                  <span className={`text-xs ${kpi.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                    {kpi.change > 0 ? '+' : ''}{kpi.change}%
                  </span>
                  <span className="text-xs text-muted-foreground mr-1">عن الشهر الماضي</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Section KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {SECTION_KPIS.map(section => (
            <Card key={section.section}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={`h-8 w-8 rounded-lg ${section.bg} flex items-center justify-center`}>
                    <section.icon className={`h-4 w-4 ${section.color}`} />
                  </div>
                  {section.section}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {section.items.map(item => (
                    <div key={item.label} className="p-2 rounded-lg bg-muted/20">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="text-base font-bold">{typeof item.value === 'number' ? item.value.toLocaleString('ar-SA') : item.value}</div>
                      <span className={`text-xs ${item.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                        {item.change}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom row: Charts area + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" /> أداء الإيرادات (آخر 6 أشهر)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <BarChart3 className="h-8 w-8 mr-2" />
                <span>سيتم عرض الرسم البياني هنا</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" /> آخر التنبيهات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {RECENT_ALERTS.map((alert, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                    <div className={`h-2 w-2 rounded-full mt-1.5 ${
                      alert.type === 'critical' ? 'bg-destructive' :
                      alert.type === 'warning' ? 'bg-warning' :
                      alert.type === 'success' ? 'bg-success' : 'bg-primary'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm">{alert.message}</p>
                      <span className="text-xs text-muted-foreground">{alert.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function CFODashboard() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b bg-card">
        <EnterpriseBreadcrumbs items={[{ label: 'التقارير التنفيذية', icon: BarChart3 }, { label: 'لوحة المدير المالي' }]} />
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold">لوحة المدير المالي</h1>
            <p className="text-sm text-muted-foreground">تحليل مالي متقدم ومؤشرات الأداء</p>
          </div>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 ml-1" /> تصدير التقرير</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'إجمالي الأصول', value: '3,200,000', change: '+5.2%', icon: DollarSign },
            { label: 'إجمالي الخصوم', value: '1,850,000', change: '+3.1%', icon: DollarSign },
            { label: 'حقوق الملكية', value: '1,350,000', change: '+8.4%', icon: TrendingUp },
            { label: 'التدفق النقدي', value: '245,000', change: '+12.7%', icon: Activity },
          ].map((item, idx) => (
            <Card key={idx}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="text-xl font-bold mt-1">{item.value} ر.س</div>
                <span className="text-xs text-success">{item.change}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base"><PieChart className="h-4 w-4 ml-2 inline" /> توزيع المصروفات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <PieChart className="h-8 w-8 mr-2" /> تحليل المصروفات
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base"><TrendingUp className="h-4 w-4 ml-2 inline" /> تحليل الاتجاهات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <BarChart3 className="h-8 w-8 mr-2" /> تحليل الاتجاهات المالية
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
