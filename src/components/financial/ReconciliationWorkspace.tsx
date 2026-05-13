'use client'

import { useState } from 'react'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { Wallet, Search, CheckCircle2, AlertTriangle, ArrowLeftRight, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MOCK_RECONCILIATIONS = [
  { id: '1', account: 'بنك الراجحي', period: 'يناير 2024', statementBalance: 1250000, bookBalance: 1248500, difference: 1500, status: 'مطابق', lastMatched: '2024-01-31' },
  { id: '2', account: 'بنك الأهلي', period: 'يناير 2024', statementBalance: 850000, bookBalance: 852300, difference: -2300, status: 'فروقات', lastMatched: '2024-01-30' },
  { id: '3', account: 'صندوق النقدية', period: 'يناير 2024', statementBalance: 45000, bookBalance: 45000, difference: 0, status: 'مطابق', lastMatched: '2024-01-31' },
  { id: '4', account: 'بنك الرياض', period: 'يناير 2024', statementBalance: 320000, bookBalance: 318500, difference: 1500, status: 'فروقات', lastMatched: '2024-01-28' },
]

const MOCK_TRANSACTIONS = [
  { id: '1', date: '2024-01-15', description: 'مقبوضات عملاء', reference: 'DEP-001', statement: 250000, book: 250000, matched: true },
  { id: '2', date: '2024-01-16', description: 'دفعة موردين', reference: 'PAY-001', statement: -85000, book: -85000, matched: true },
  { id: '3', date: '2024-01-17', description: 'رسوم بنكية', reference: 'CHG-001', statement: -500, book: 0, matched: false },
  { id: '4', date: '2024-01-18', description: 'إيداع شيك', reference: 'DEP-002', statement: 0, book: 150000, matched: false },
  { id: '5', date: '2024-01-20', description: 'تحويل داخلي', reference: 'TRF-001', statement: -50000, book: -50000, matched: true },
  { id: '6', date: '2024-01-22', description: 'فوائد بنكية', reference: 'INT-001', statement: 1200, book: 0, matched: false },
  { id: '7', date: '2024-01-25', description: 'مقبوضات نقدية', reference: 'DEP-003', statement: 75000, book: 75000, matched: true },
  { id: '8', date: '2024-01-28', description: 'سداد قرض', reference: 'LOAN-001', statement: -25000, book: -25000, matched: true },
]

export function ReconciliationWorkspace() {
  const [selectedAccount, setSelectedAccount] = useState(MOCK_RECONCILIATIONS[0])
  const [showMatched, setShowMatched] = useState(true)

  const matchedCount = MOCK_TRANSACTIONS.filter(t => t.matched).length
  const unmatchedCount = MOCK_TRANSACTIONS.filter(t => !t.matched).length
  const totalMatch = MOCK_TRANSACTIONS.filter(t => t.matched).reduce((s, t) => s + t.statement, 0)
  const totalUnmatched = MOCK_TRANSACTIONS.filter(t => !t.matched).reduce((s, t) => s + Math.abs(t.statement || t.book), 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b bg-card">
        <EnterpriseBreadcrumbs items={[
          { label: 'المالية', icon: Wallet },
          { label: 'التسويات البنكية' },
        ]} />
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold">تسويات بنكية</h1>
            <p className="text-sm text-muted-foreground">مطابقة الحركات البنكية مع كشف الحساب</p>
          </div>
          <Button size="sm">
            <ArrowLeftRight className="h-4 w-4 ml-1" />
            تسوية جديدة
          </Button>
        </div>

        {/* Account selector */}
        <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
          {MOCK_RECONCILIATIONS.map(acc => (
            <button
              key={acc.id}
              onClick={() => setSelectedAccount(acc)}
              className={`flex-shrink-0 p-4 rounded-xl border text-right transition-all ${
                selectedAccount.id === acc.id ? 'border-primary bg-primary/5 shadow-sm' : 'hover:border-muted-foreground/30'
              }`}
            >
              <div className="text-sm font-medium">{acc.account}</div>
              <div className="text-xs text-muted-foreground">{acc.period}</div>
              <div className={`mt-2 text-lg font-bold ${acc.status === 'مطابق' ? 'text-success' : 'text-warning'}`}>
                {acc.difference.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span>
              </div>
              <div className={`mt-1 text-xs px-2 py-0.5 rounded-full inline-block ${
                acc.status === 'مطابق' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
              }`}>
                {acc.status}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: matching area */}
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">حريات التسوية</h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showMatched} onChange={() => setShowMatched(!showMatched)}
                  className="rounded border-gray-300" />
                إظهار المطابقات
              </label>
              <div className="relative">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input placeholder="بحث..." className="h-9 pr-8 w-48 bg-muted/50 border rounded-lg text-xs outline-none" />
              </div>
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">البيان</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">المرجع</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">كشف الحساب</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">الدفاتر</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {(showMatched ? MOCK_TRANSACTIONS : MOCK_TRANSACTIONS.filter(t => !t.matched)).map(tx => (
                  <tr key={tx.id} className={`border-b hover:bg-accent/30 transition-colors ${!tx.matched ? 'bg-warning/5' : ''}`}>
                    <td className="px-4 py-3">{new Date(tx.date).toLocaleDateString('ar-SA')}</td>
                    <td className="px-4 py-3">{tx.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">{tx.reference}</td>
                    <td className={`px-4 py-3 text-left font-mono ${tx.statement < 0 ? 'text-destructive' : 'text-success'}`}>
                      {tx.statement.toLocaleString('ar-SA')}
                    </td>
                    <td className={`px-4 py-3 text-left font-mono ${tx.book < 0 ? 'text-destructive' : 'text-success'}`}>
                      {tx.book.toLocaleString('ar-SA')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tx.matched
                        ? <CheckCircle2 className="h-5 w-5 text-success mx-auto" />
                        : <AlertTriangle className="h-5 w-5 text-warning mx-auto" />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: summary panel */}
        <div className="w-72 border-l p-4 bg-muted/20 space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-3">ملخص التسوية</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">مطابقات</span>
                <span className="font-medium text-success">{matchedCount} حركة</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">فروقات</span>
                <span className="font-medium text-warning">{unmatchedCount} حركة</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">إجمالي مطابق</span>
                  <span className="font-medium">{totalMatch.toLocaleString('ar-SA')} ر.س</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">إجمالي الفروقات</span>
                  <span className="font-medium text-warning">{totalUnmatched.toLocaleString('ar-SA')} ر.س</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-2">إجراءات</h3>
            <div className="space-y-1">
              <button className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">
                <CheckCircle2 className="h-4 w-4 ml-2 inline" /> تطابق تلقائي
              </button>
              <button className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">
                <FileText className="h-4 w-4 ml-2 inline" /> إنشاء قيود تسوية
              </button>
              <button className="w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors">
                <Search className="h-4 w-4 ml-2 inline" /> مراجعة الفروقات
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
