import { createClient }             from '@/lib/supabase/server'
import { getCompanyId }              from '@/lib/tenant'
import Link                          from 'next/link'
import { Calendar, Lock, CheckCircle, Plus, ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PeriodsPage() {
  const supabase   = createClient()
  const company_id = getCompanyId()

  const [fyResult, periodsResult] = await Promise.all([
    supabase
      .from('fiscal_years')
      .select('*')
      .eq('company_id', company_id)
      .order('start_date', { ascending: false }),
    supabase
      .from('accounting_periods')
      .select('*')
      .eq('company_id', company_id)
      .order('start_date', { ascending: false }),
  ])

  const fiscalYears = fyResult.data    || []
  const periods     = periodsResult.data || []

  // Group periods by fiscal year
  const periodsByFY = periods.reduce((g: Record<string, any[]>, p: any) => {
    if (!g[p.fiscal_year_id]) g[p.fiscal_year_id] = []
    g[p.fiscal_year_id].push(p)
    return g
  }, {})

  return (
    <div className="p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الفترات المالية</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة السنوات والفترات المحاسبية</p>
        </div>
        <form action="/api/accounting/periods" method="POST">
          <input type="hidden" name="action" value="ensure_fiscal_year" />
          <button
            type="submit"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            إنشاء السنة الحالية
          </button>
        </form>
      </div>

      {fiscalYears.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Calendar className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p>لا توجد سنوات مالية. اضغط "إنشاء السنة الحالية"</p>
        </div>
      ) : fiscalYears.map((fy: any) => (
        <div key={fy.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* FY Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  {fy.name}
                  {fy.is_current && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                      <CheckCircle className="h-3 w-3" />
                      الحالية
                    </span>
                  )}
                  {fy.status === 'closed' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
                      <Lock className="h-3 w-3" />
                      مغلقة
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500">{fy.start_date} — {fy.end_date}</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {(periodsByFY[fy.id] || []).length} فترة
            </div>
          </div>

          {/* Periods Grid */}
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {(periodsByFY[fy.id] || [])
              .sort((a: any, b: any) => a.period_number - b.period_number)
              .map((period: any) => (
              <div
                key={period.id}
                className={`rounded-lg border p-3 ${
                  period.status === 'closed'
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-700">
                    {period.period_number}
                  </span>
                  {period.status === 'closed'
                    ? <Lock className="h-3 w-3 text-gray-400" />
                    : <CheckCircle className="h-3 w-3 text-blue-500" />
                  }
                </div>
                <p className="text-xs font-medium text-gray-800">{period.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {period.start_date.slice(5)} — {period.end_date.slice(5)}
                </p>
                <span className={`inline-block mt-1.5 text-xs px-1.5 py-0.5 rounded ${
                  period.status === 'closed'
                    ? 'bg-gray-100 text-gray-500'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {period.status === 'closed' ? 'مغلقة' : 'مفتوحة'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
