'use client'

import { useState } from 'react'
import { Search, RotateCcw, Package, Check, X, AlertCircle, Loader2, Plus, ArrowRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  returns: any[]
  warehouses: any[]
  companyId: string
  currency: string
}

const REFUND_METHODS = [
  { value: 'cash', label: 'نقدي' },
  { value: 'credit', label: 'خصم من الرصيد' },
  { value: 'exchange', label: 'استبدال' },
]

export function ReturnsClient({ returns: initialReturns, warehouses, companyId, currency }: Props) {
  const [returns, setReturns] = useState(initialReturns)
  const [view, setView] = useState<'list' | 'new'>('list')
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [foundSale, setFoundSale] = useState<any>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; quantity: number; reason: string }>>({})
  const [refundMethod, setRefundMethod] = useState('cash')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const searchInvoice = async () => {
    if (!invoiceSearch.trim()) return
    setSearching(true); setSearchError(''); setFoundSale(null); setSelectedItems({})
    try {
      const res = await fetch(`/api/sales/lookup?invoice=${encodeURIComponent(invoiceSearch.trim())}`)
      const data = await res.json()
      if (!res.ok || !data) throw new Error('لم يتم العثور على الفاتورة')
      setFoundSale(data)
      // Init selected items
      const init: Record<string, any> = {}
      data.sale_items?.forEach((item: any) => {
        init[item.id] = { selected: false, quantity: item.quantity, reason: '' }
      })
      setSelectedItems(init)
    } catch (e: any) {
      setSearchError(e.message)
    } finally {
      setSearching(false)
    }
  }

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], selected: !prev[itemId].selected },
    }))
  }

  const updateQty = (itemId: string, qty: number) => {
    setSelectedItems(prev => ({ ...prev, [itemId]: { ...prev[itemId], quantity: qty } }))
  }

  const selectedCount = Object.values(selectedItems).filter(i => i.selected).length
  const returnTotal = foundSale?.sale_items
    ?.filter((item: any) => selectedItems[item.id]?.selected)
    .reduce((s: number, item: any) => {
      const qty = selectedItems[item.id]?.quantity || 0
      return s + qty * item.unit_price
    }, 0) || 0

  const handleReturn = async () => {
    if (!foundSale || selectedCount === 0) return
    setLoading(true); setError('')
    try {
      const items = foundSale.sale_items
        .filter((item: any) => selectedItems[item.id]?.selected)
        .map((item: any) => ({
          sale_item_id: item.id,
          product_id: item.product_id,
          quantity: selectedItems[item.id].quantity,
          unit_price: item.unit_price,
          total: selectedItems[item.id].quantity * item.unit_price,
          reason: selectedItems[item.id].reason,
        }))

      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_id: foundSale.id,
          items,
          refund_method: refundMethod,
          reason,
          notes,
          warehouse_id: warehouseId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(`تم إنشاء المرتجع ${data.return_number} بنجاح`)
      setFoundSale(null); setInvoiceSearch(''); setSelectedItems({})
      setView('list')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">المرتجعات</h1>
          <p className="text-sm text-muted-foreground">{returns.length} مرتجع</p>
        </div>
        <button
          onClick={() => { setView(view === 'list' ? 'new' : 'list'); setFoundSale(null); setSuccess(''); setError('') }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90"
        >
          {view === 'new' ? <><ArrowRight className="w-4 h-4" /> القائمة</> : <><Plus className="w-4 h-4" /> مرتجع جديد</>}
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 text-sm p-3 rounded-xl">
          <Check className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* NEW RETURN FORM */}
      {view === 'new' && (
        <div className="space-y-4">
          {/* Step 1: Search Invoice */}
          <div className="bg-card border rounded-2xl p-5">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-primary text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
              ابحث عن الفاتورة
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={invoiceSearch}
                onChange={e => setInvoiceSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchInvoice()}
                placeholder="رقم الفاتورة (مثال: INV-00001)"
                className="flex-1 border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background font-mono"
                dir="ltr"
                autoFocus
              />
              <button
                onClick={searchInvoice}
                disabled={searching}
                className="bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                بحث
              </button>
            </div>
            {searchError && (
              <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {searchError}
              </p>
            )}
          </div>

          {/* Step 2: Select Items */}
          {foundSale && (
            <div className="bg-card border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold flex items-center gap-2">
                  <span className="w-6 h-6 bg-primary text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
                  اختر المنتجات المُرجَعة
                </h2>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">فاتورة: <span className="font-mono font-bold text-primary">{foundSale.invoice_number}</span></p>
                  {foundSale.customers?.name && <p className="text-xs text-muted-foreground">العميل: {foundSale.customers.name}</p>}
                </div>
              </div>

              <div className="space-y-2">
                {foundSale.sale_items?.map((item: any) => {
                  const sel = selectedItems[item.id]
                  return (
                    <div
                      key={item.id}
                      className={cn('border rounded-xl p-3 transition-all cursor-pointer',
                        sel?.selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                      )}
                      onClick={() => toggleItem(item.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                          sel?.selected ? 'bg-primary border-primary' : 'border-border'
                        )}>
                          {sel?.selected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.products?.name_ar || item.products?.name || 'منتج'}</p>
                          <p className="text-xs text-muted-foreground">{item.quantity} × {formatCurrency(item.unit_price, currency)}</p>
                        </div>
                        <p className="text-sm font-bold text-primary">{formatCurrency(item.total, currency)}</p>
                      </div>
                      {sel?.selected && (
                        <div className="mt-2 pt-2 border-t border-primary/20 flex items-center gap-3" onClick={e => e.stopPropagation()}>
                          <label className="text-xs text-muted-foreground whitespace-nowrap">الكمية المُرجَعة:</label>
                          <input
                            type="number"
                            value={sel.quantity}
                            onChange={e => updateQty(item.id, Math.min(parseFloat(e.target.value) || 1, item.quantity))}
                            className="w-20 border border-border rounded-lg px-2 py-1 text-sm text-center focus:outline-none bg-background"
                            min="0.01"
                            max={item.quantity}
                            step="1"
                          />
                          <span className="text-xs text-muted-foreground">/ {item.quantity}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 3: Return Details */}
          {foundSale && selectedCount > 0 && (
            <div className="bg-card border rounded-2xl p-5 space-y-4">
              <h2 className="font-bold flex items-center gap-2">
                <span className="w-6 h-6 bg-primary text-white rounded-full text-xs flex items-center justify-center font-bold">3</span>
                تفاصيل الإرجاع
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">طريقة الاسترداد</label>
                  <div className="space-y-1">
                    {REFUND_METHODS.map(m => (
                      <label key={m.value} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="refund" value={m.value} checked={refundMethod === m.value} onChange={() => setRefundMethod(m.value)} className="accent-primary" />
                        <span className="text-sm">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {warehouses.length > 1 && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">المستودع</label>
                    <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none">
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar || w.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">سبب الإرجاع</label>
                <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="مثال: منتج تالف، خطأ في الطلب..." className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>

              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات إضافية..." className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary/20" />

              {/* Summary */}
              <div className="bg-muted/50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{selectedCount} منتج مُختار</p>
                  <p className="text-xs text-muted-foreground mt-0.5">سيعود المخزون تلقائياً</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">قيمة المرتجع</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(returnTotal, currency)}</p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 text-xs p-3 rounded-xl">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleReturn}
                disabled={loading}
                className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                تأكيد المرتجع · {formatCurrency(returnTotal, currency)}
              </button>
            </div>
          )}
        </div>
      )}

      {/* RETURNS LIST */}
      {view === 'list' && (
        <div className="bg-card border rounded-2xl overflow-hidden">
          {returns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <RotateCcw className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">لا توجد مرتجعات</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم المرتجع</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">الفاتورة</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">العميل</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">المبلغ</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">طريقة الاسترداد</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {returns.map(ret => (
                  <tr key={ret.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-primary">{ret.return_number}</td>
                    <td className="px-4 py-3 font-mono text-xs">{(ret.sales as any)?.invoice_number || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{(ret.customers as any)?.name || 'غير محدد'}</td>
                    <td className="px-4 py-3 font-medium text-red-600">{formatCurrency(ret.total, currency)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-accent px-2 py-0.5 rounded-full">
                        {REFUND_METHODS.find(m => m.value === ret.refund_method)?.label || ret.refund_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(ret.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
