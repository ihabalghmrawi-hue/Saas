'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, User,
  CreditCard, Banknote, Wallet, Printer, ChevronDown,
  Package, X, Check, AlertCircle, Calculator, Tag
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Product, ProductCategory, Customer, Warehouse, CartItem, SalePayment } from '@/types/erp'
import { cn } from '@/lib/utils'

interface POSClientProps {
  products: Product[]
  categories: ProductCategory[]
  customers: Customer[]
  warehouses: Warehouse[]
  defaultWarehouseId: string | null
  companyId: string
  currency: string
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقدي', icon: Banknote, color: 'text-green-600' },
  { value: 'card', label: 'بطاقة', icon: CreditCard, color: 'text-blue-600' },
  { value: 'wallet', label: 'محفظة', icon: Wallet, color: 'text-purple-600' },
  { value: 'credit', label: 'آجل', icon: Tag, color: 'text-orange-600' },
] as const

export function POSClient({ products, categories, customers, warehouses, defaultWarehouseId, companyId, currency }: POSClientProps) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerList, setShowCustomerList] = useState(false)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<SalePayment['method']>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warehouseId] = useState(defaultWarehouseId)
  const searchRef = useRef<HTMLInputElement>(null)

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.name_ar && p.name_ar.includes(search)) ||
        (p.barcode && p.barcode.includes(search)) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
      const matchCategory = !selectedCategory || p.category_id === selectedCategory
      return matchSearch && matchCategory
    })
  }, [products, search, selectedCategory])

  const filteredCustomers = useMemo(() =>
    customers.filter(c =>
      !customerSearch ||
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch))
    ), [customers, customerSearch])

  // Cart calculations
  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.total, 0), [cart])
  const discountAmount = useMemo(() => (subtotal * discountPercent) / 100, [subtotal, discountPercent])
  const taxAmount = useMemo(() => cart.reduce((s, i) => s + i.tax_amount, 0), [cart])
  const total = useMemo(() => subtotal - discountAmount, [subtotal, discountAmount])
  const change = useMemo(() => Math.max(0, parseFloat(cashReceived || '0') - total), [cashReceived, total])

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price * (1 - i.discount_percent / 100) }
            : i
        )
      }
      const newItem: CartItem = {
        product,
        quantity: 1,
        unit_price: product.sale_price,
        discount_percent: 0,
        discount_amount: 0,
        tax_rate: product.tax_rate,
        tax_amount: product.sale_price * (product.tax_rate / 100),
        total: product.sale_price,
      }
      return [...prev, newItem]
    })
  }, [])

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.product.id !== productId))
      return
    }
    setCart(prev => prev.map(i =>
      i.product.id === productId
        ? { ...i, quantity: qty, total: qty * i.unit_price * (1 - i.discount_percent / 100) }
        : i
    ))
  }, [])

  const updateItemDiscount = useCallback((productId: string, disc: number) => {
    setCart(prev => prev.map(i =>
      i.product.id === productId
        ? { ...i, discount_percent: disc, total: i.quantity * i.unit_price * (1 - disc / 100) }
        : i
    ))
  }, [])

  const removeItem = useCallback((productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId))
  }, [])

  const clearCart = () => {
    setCart([])
    setDiscountPercent(0)
    setCashReceived('')
    setSelectedCustomer(null)
    setNotes('')
    setSuccess(null)
    setError(null)
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          warehouse_id: warehouseId,
          customer_id: selectedCustomer?.id || null,
          items: cart.map(i => ({
            product_id: i.product.id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            cost_price: i.product.cost_price,
            discount_percent: i.discount_percent,
            tax_rate: i.tax_rate,
            total: i.total,
          })),
          subtotal,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total,
          paid_amount: paymentMethod === 'credit' ? 0 : parseFloat(cashReceived || total.toFixed(2)),
          payment_method: paymentMethod,
          notes,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'حدث خطأ')

      setSuccess(`تم إنشاء الفاتورة ${data.invoice_number} بنجاح`)
      clearCart()
      searchRef.current?.focus()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const getStock = (product: Product) => {
    const inv = (product.inventory as any[])?.find((i: any) => i.warehouse_id === warehouseId)
    return inv?.quantity ?? product.inventory?.[0]?.quantity ?? 0
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 -m-6">
      {/* LEFT: Products */}
      <div className="flex-1 flex flex-col bg-background border-l">
        {/* Search */}
        <div className="p-3 border-b bg-card">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الباركود أو الكود..."
              className="w-full bg-background border border-input rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              dir="rtl"
              autoFocus
            />
          </div>
          {/* Categories */}
          <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn('px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all', !selectedCategory ? 'bg-primary text-white' : 'bg-accent hover:bg-accent/80')}
            >
              الكل ({products.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className={cn('px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all', selectedCategory === cat.id ? 'bg-primary text-white' : 'bg-accent hover:bg-accent/80')}
              >
                {cat.name_ar || cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Package className="w-12 h-12 mb-2 opacity-30" />
              <p className="text-sm">لا توجد منتجات</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {filteredProducts.map(product => {
                const stock = getStock(product)
                const inCart = cart.find(i => i.product.id === product.id)
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.track_inventory && stock <= 0}
                    className={cn(
                      'relative flex flex-col items-center p-3 rounded-xl border text-center transition-all hover:shadow-md active:scale-95',
                      inCart ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/50',
                      product.track_inventory && stock <= 0 && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {inCart && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                        {inCart.quantity}
                      </div>
                    )}
                    <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center mb-2">
                      <Package className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-medium text-foreground line-clamp-2 mb-1">
                      {product.name_ar || product.name}
                    </p>
                    <p className="text-sm font-bold text-primary">{formatCurrency(product.sale_price, currency)}</p>
                    {product.track_inventory && (
                      <p className={cn('text-[10px] mt-0.5', stock <= product.min_stock_level ? 'text-red-500' : 'text-muted-foreground')}>
                        {stock <= 0 ? 'نفذ المخزون' : `المخزون: ${stock}`}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart */}
      <div className="w-80 xl:w-96 flex flex-col bg-card border-r shadow-lg">
        {/* Cart Header */}
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">السلة ({cart.length})</span>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
              <Trash2 className="w-3 h-3" />
              مسح
            </button>
          )}
        </div>

        {/* Customer */}
        <div className="p-3 border-b relative">
          <div className="relative">
            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={selectedCustomer ? selectedCustomer.name : customerSearch}
              onChange={e => {
                setCustomerSearch(e.target.value)
                setSelectedCustomer(null)
                setShowCustomerList(true)
              }}
              onFocus={() => setShowCustomerList(true)}
              placeholder="اختر العميل (اختياري)"
              className="w-full border border-input rounded-lg px-3 py-1.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
            />
            {selectedCustomer && (
              <button onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }} className="absolute left-3 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
          {showCustomerList && !selectedCustomer && filteredCustomers.length > 0 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
              {filteredCustomers.slice(0, 8).map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c); setShowCustomerList(false); setCustomerSearch('') }}
                  className="w-full text-right px-3 py-2 text-sm hover:bg-accent flex justify-between items-center"
                >
                  <span>{c.name}</span>
                  {c.balance > 0 && <span className="text-xs text-red-500">{formatCurrency(c.balance, currency)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="w-10 h-10 opacity-20 mb-2" />
              <p className="text-sm">اضغط على منتج لإضافته</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="bg-background rounded-lg p-2 border border-border">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-foreground line-clamp-1 flex-1">
                    {item.product.name_ar || item.product.name}
                  </p>
                  <button onClick={() => removeItem(item.product.id)} className="text-muted-foreground hover:text-red-500 shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5 gap-2">
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <button onClick={() => updateQty(item.product.id, item.quantity - 1)} className="px-2 py-1 hover:bg-accent text-sm">
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={e => updateQty(item.product.id, parseFloat(e.target.value) || 0)}
                      className="w-10 text-center text-sm bg-transparent border-x border-border py-1 focus:outline-none"
                    />
                    <button onClick={() => updateQty(item.product.id, item.quantity + 1)} className="px-2 py-1 hover:bg-accent text-sm">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={e => {
                        const price = parseFloat(e.target.value) || 0
                        setCart(prev => prev.map(i =>
                          i.product.id === item.product.id
                            ? { ...i, unit_price: price, total: item.quantity * price * (1 - i.discount_percent / 100) }
                            : i
                        ))
                      }}
                      className="w-16 text-center text-sm bg-background border border-border rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                  <p className="text-sm font-bold text-primary whitespace-nowrap">
                    {formatCurrency(item.total, currency)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals */}
        <div className="border-t p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">المجموع الجزئي</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>

          {/* Discount */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">خصم %</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="100"
                value={discountPercent || ''}
                onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-16 text-center text-sm border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background"
              />
              {discountAmount > 0 && (
                <span className="text-sm text-red-500">- {formatCurrency(discountAmount, currency)}</span>
              )}
            </div>
          </div>

          <div className="flex justify-between text-base font-bold border-t pt-2">
            <span>الإجمالي</span>
            <span className="text-primary text-lg">{formatCurrency(total, currency)}</span>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-4 gap-1">
            {PAYMENT_METHODS.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] border transition-all',
                    paymentMethod === m.value
                      ? 'bg-primary text-white border-primary'
                      : 'border-border hover:border-primary/50 bg-background'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              )
            })}
          </div>

          {/* Cash Received */}
          {paymentMethod === 'cash' && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">المبلغ المستلم</label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  placeholder={total.toFixed(2)}
                  className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-center font-bold"
                />
              </div>
              {parseFloat(cashReceived) > 0 && change > 0 && (
                <div className="flex justify-between text-sm bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-1.5">
                  <span className="text-green-700 dark:text-green-400">الباقي</span>
                  <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(change, currency)}</span>
                </div>
              )}
            </div>
          )}

          {/* Quick cash buttons */}
          {paymentMethod === 'cash' && (
            <div className="grid grid-cols-4 gap-1">
              {[50, 100, 200, 500].map(v => (
                <button
                  key={v}
                  onClick={() => setCashReceived(v.toString())}
                  className="text-xs py-1 bg-accent hover:bg-accent/80 rounded text-center"
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          {/* Notes */}
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="ملاحظات..."
            className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background"
          />

          {/* Alerts */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 text-xs p-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-600 text-xs p-2 rounded-lg">
              <Check className="w-3.5 h-3.5 shrink-0" />
              {success}
            </div>
          )}

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className={cn(
              'w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
              cart.length > 0
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md active:scale-95'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                إتمام البيع · {formatCurrency(total, currency)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
