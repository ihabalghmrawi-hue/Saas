'use client'

import { useState } from 'react'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { Wallet, TrendingUp, TrendingDown, Search, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

const ACCOUNT_TYPES = ['الأصول', 'الخصوم', 'حقوق الملكية', 'الإيرادات', 'المصروفات']

const ACCOUNTS = [
  { code: '110001', name: 'صندوق النقدية', type: 'الأصول', balance: 450000, dr: 1500000, cr: 1050000, level: 0 },
  { code: '110002', name: 'بنك الراجحي', type: 'الأصول', balance: 1250000, dr: 3200000, cr: 1950000, level: 0 },
  { code: '110003', name: 'بنك الأهلي', type: 'الأصول', balance: 850000, dr: 2100000, cr: 1250000, level: 0 },
  { code: '120001', name: 'عملاء', type: 'الأصول', balance: 680000, dr: 980000, cr: 300000, level: 0, children: [
    { code: '120001-01', name: 'شركة الأفق', type: 'الأصول', balance: 250000, dr: 450000, cr: 200000, level: 1 },
    { code: '120001-02', name: 'مؤسسة النور', type: 'الأصول', balance: 180000, dr: 280000, cr: 100000, level: 1 },
    { code: '120001-03', name: 'شركة البركة', type: 'الأصول', balance: 250000, dr: 250000, cr: 0, level: 1 },
  ]},
  { code: '130001', name: 'مخزون البضاعة', type: 'الأصول', balance: 920000, dr: 1500000, cr: 580000, level: 0 },
  { code: '210001', name: 'موردون', type: 'الخصوم', balance: -340000, dr: 560000, cr: 900000, level: 0 },
  { code: '210002', name: 'أوراق دفع', type: 'الخصوم', balance: -200000, dr: 100000, cr: 300000, level: 0 },
  { code: '310001', name: 'رأس المال', type: 'حقوق الملكية', balance: -2000000, dr: 0, cr: 2000000, level: 0 },
  { code: '310002', name: 'الأرباح المحتجزة', type: 'حقوق الملكية', balance: -450000, dr: 50000, cr: 500000, level: 0 },
  { code: '410001', name: 'إيرادات مبيعات', type: 'الإيرادات', balance: -3500000, dr: 3500000, cr: 7000000, level: 0 },
  { code: '510001', name: 'تكلفة المبيعات', type: 'المصروفات', balance: 2100000, dr: 2100000, cr: 0, level: 0 },
  { code: '510002', name: 'مصروفات إدارية', type: 'المصروفات', balance: 350000, dr: 350000, cr: 0, level: 0 },
  { code: '510003', name: 'مرتبات', type: 'المصروفات', balance: 520000, dr: 520000, cr: 0, level: 0 },
]

function flattenAccounts(accounts: typeof ACCOUNTS): typeof ACCOUNTS {
  const result: typeof ACCOUNTS = []
  for (const acc of accounts) {
    result.push(acc)
    if ((acc as any).children) result.push(...(acc as any).children)
  }
  return result
}

function computeTotals(type: string) {
  const accounts = ACCOUNTS.filter(a => a.type === type)
  const totalDr = accounts.reduce((s, a) => s + a.dr, 0)
  const totalCr = accounts.reduce((s, a) => s + a.cr, 0)
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  return { totalDr, totalCr, totalBalance }
}

export function TrialBalanceExplorer() {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(ACCOUNT_TYPES))
  const [searchQuery, setSearchQuery] = useState('')
  const [activeType, setActiveType] = useState<string | null>(null)

  const toggleType = (type: string) => {
    const next = new Set(expandedTypes)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    setExpandedTypes(next)
  }

  const filteredTypes = ACCOUNT_TYPES.filter(t => !activeType || t === activeType)
  const totalDr = ACCOUNTS.reduce((s, a) => s + a.dr, 0)
  const totalCr = ACCOUNTS.reduce((s, a) => s + a.cr, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b bg-card">
        <EnterpriseBreadcrumbs items={[
          { label: 'المالية', icon: Wallet },
          { label: 'ميزان المراجعة' },
        ]} />
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold">ميزان المراجعة</h1>
            <p className="text-sm text-muted-foreground">عرض أرصدة الحسابات والتأكد من توازن القيود</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"><Download className="h-4 w-4 ml-1" /> تصدير</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">إجمالي الأرصدة المدينة</div>
            <div className="text-xl font-bold text-success">{totalDr.toLocaleString('ar-SA')} ر.س</div>
          </div>
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">إجمالي الأرصدة الدائنة</div>
            <div className="text-xl font-bold">{totalCr.toLocaleString('ar-SA')} ر.س</div>
          </div>
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">الفرق</div>
            <div className={`text-xl font-bold ${totalDr === totalCr ? 'text-success' : 'text-destructive'}`}>
              {Math.abs(totalDr - totalCr).toLocaleString('ar-SA')} ر.س
              {totalDr === totalCr && <TrendingUp className="h-5 w-5 mr-2 inline text-success" />}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Type filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          <button
            onClick={() => setActiveType(null)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${!activeType ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}
          >
            الكل
          </button>
          {ACCOUNT_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${activeType === type ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث عن حساب..."
            className="w-full h-10 pr-10 bg-muted/50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Trial Balance Table */}
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-right px-4 py-3 font-medium text-muted-foreground w-24">الكود</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">اسم الحساب</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">مدين</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">دائن</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {filteredTypes.map(type => {
                const accounts = ACCOUNTS.filter(a => a.type === type)
                const visible = accounts.filter(a => !searchQuery || a.name.includes(searchQuery) || a.code.includes(searchQuery))
                if (visible.length === 0) return null
                const totals = computeTotals(type)
                const isExpanded = expandedTypes.has(type)

                return (
                  <tbody key={type}>
                    <tr className="bg-muted/30 border-b cursor-pointer hover:bg-muted/50" onClick={() => toggleType(type)}>
                      <td colSpan={5} className="px-4 py-2.5">
                        <div className="flex items-center gap-2 font-semibold">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          <span>{type}</span>
                          <span className="text-xs text-muted-foreground">({accounts.length})</span>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && visible.map(acc => (
                      <tr key={acc.code} className="border-b hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{acc.code}</td>
                        <td className={`px-4 py-2.5 ${acc.level === 1 ? 'pr-8 text-muted-foreground' : 'font-medium'}`}>{acc.name}</td>
                        <td className="px-4 py-2.5 text-left font-mono tabular-nums">{acc.dr > 0 ? acc.dr.toLocaleString('ar-SA') : '-'}</td>
                        <td className="px-4 py-2.5 text-left font-mono tabular-nums">{acc.cr > 0 ? acc.cr.toLocaleString('ar-SA') : '-'}</td>
                        <td className={`px-4 py-2.5 text-left font-mono tabular-nums ${acc.balance > 0 ? 'amount-positive' : 'amount-negative'}`}>
                          {Math.abs(acc.balance).toLocaleString('ar-SA')}
                        </td>
                      </tr>
                    ))}
                    {isExpanded && (
                      <tr className="bg-muted/20 border-b font-medium">
                        <td colSpan={2} className="px-4 py-2.5 text-left">إجمالي {type}</td>
                        <td className="px-4 py-2.5 text-left font-mono">{totals.totalDr.toLocaleString('ar-SA')}</td>
                        <td className="px-4 py-2.5 text-left font-mono">{totals.totalCr.toLocaleString('ar-SA')}</td>
                        <td className={`px-4 py-2.5 text-left font-mono ${totals.totalBalance > 0 ? 'amount-positive' : 'amount-negative'}`}>
                          {Math.abs(totals.totalBalance).toLocaleString('ar-SA')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
