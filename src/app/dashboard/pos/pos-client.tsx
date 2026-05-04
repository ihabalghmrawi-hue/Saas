'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, User,
  CreditCard, Banknote, Wallet, Printer, Package, X,
  Check, AlertCircle, Tag, ChevronDown, ReceiptText,
  Keyboard, Percent, Hash, Split
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface CartItem {
  product: any
  quantity: number
  unit_price: number
  discount_percent: number
  tax_rate: number
  tax_amount: number
  total: number
}

interface Payment {
  method: 'cash' | 'card' | 'wallet' | 'credit'
  amount: number
  label: string
}

interface POSClientProps {
  products: any[]
  categories: any[]
  customers: any[]
  warehouses: any[]
  defaultWarehouseId: string | null
  companyId: string
  currency: string
}

interface SaleReceipt {
  invoice_number: string
  sale_id: string
  items: CartItem[]
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  paid_amount: number
  change_amount: number
  customer_name?: string
  date: string
  payments: Payment[]
}

const PAYMENT_METHODS = [
  { value: 'cash' as const, label: 'نقدي', icon: Banknote, color: 'bg-green-500' },
  { value: 'card' as const, label: 'بطاقة', icon: CreditCard, color: 'bg-blue-500' },
  { value: 'wallet' as const, label: 'محفظة', icon: Wallet, color: 'bg-purple-500' },
  { value: 'credit' as const, label: 'آجل', icon: Tag, color: 'bg-orange-500' },
]

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500]

export function POSClient({ products, categories, customers, warehouses, defaultWarehouseId, companyId, currency }: POSClientProps) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerList, setShowCustomerList] = useState(false)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [discountFixed, setDiscountFixed] = useState(0)
  const [discountMode, setDiscountMode] = useState<'percent' | 'fixed'>('percent')
  const [payments, setPayments] = useState<Payment[]>([{ method: 'cash', amount: 0, label: 'نقدي' }])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null)
  const [warehouseId] = useState(defaultWarehouseId)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [companyName] = useState(process.env.NEXT_PUBLIC_COMPANY_NAME || 'المتجر')

  const searchRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const barcodeTimer = useRef<NodeJS.Timeout>()

  // Totals
  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.total, 0), [cart])
  const discountAmount = useMemo(() => {
    if (discountMode === 'fixed') return Math.min(discountFixed, subtotal)
    return (subtotal * discountPercent) / 100
  }, [subtotal, discountPercent, discountFixed, discountMode])
  const taxAmount = useMemo(() => cart.reduce((s, i) => s + i.tax_amount, 0), [cart])
  const total = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount])
  const totalPaid = useMemo(() => payments.reduce((s, p) => s + p.amount, 0), [payments])
  const remaining = useMemo(() => Math.max(0, total - totalPaid), [total, totalPaid])
  const change = useMemo(() => Math.max(0, totalPaid - total), [totalPaid, total])

  const getStock = useCallback((product: any) => {
    if (!Array.isArray(product.inventory)) return 0
    const inv = product.inventory.find((i: any) => i.warehouse_id === warehouseId)
    return inv?.quantity ?? product.inventory[0]?.quantity ?? 0
  }, [warehouseId])

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = !search ||
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.name_ar || '').includes(search) ||
        (p.barcode || '').includes(search) ||
        (p.sku || '').toLowerCase().includes(search.toLowerCase())
      const matchCat = !selectedCategory || p.category_id === selectedCategory
      return matchSearch && matchCat
    })
  }, [products, search, selectedCategory])

  const filteredCustomers = useMemo(() =>
    customers.filter(c =>
      !customerSearch ||
      (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone || '').includes(customerSearch)
    ), [customers, customerSearch])

  const addToCart = useCallback((product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        const qty = existing.quantity + 1
        return prev.map(i => i.product.id === product.id
          ? { ...i, quantity: qty, total: qty * i.unit_price * (1 - i.discount_percent / 100) }
          : i
        )
      }
      const price = Number(product.sale_price) || 0
      const taxRate = Number(product.tax_rate) || 0
      return [...prev, {
        product,
        quantity: 1,
        unit_price: price,
        discount_percent: 0,
        tax_rate: taxRate,
        tax_amount: price * (taxRate / 100),
        total: price,
      }]
    })
    setSearch('')
    searchRef.current?.focus()
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

  const updatePrice = useCallback((productId: string, price: number) => {
    setCart(prev => prev.map(i =>
      i.product.id === productId
        ? { ...i, unit_price: price, total: i.quantity * price * (1 - i.discount_percent / 100) }
        : i
    ))
  }, [])

  const removeItem = useCallback((productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setDiscountPercent(0)
    setDiscountFixed(0)
    setSelectedCustomer(null)
    setCustomerSearch('')
    setNotes('')
    setError(null)
    setPayments([{ method: 'cash', amount: 0, label: 'نقدي' }])
    searchRef.current?.focus()
  }, [])

  // Barcode scanner detection: chars arriving < 50ms apart = scanner
  const handleSearchInput = useCallback((value: string) => {
    setSearch(value)
    clearTimeout(barcodeTimer.current)
    barcodeBuffer.current = value

    barcodeTimer.current = setTimeout(() => {
      const barcode = barcodeBuffer.current.trim()
      barcodeBuffer.current = ''
      if (!barcode) return
      const product = products.find(p =>
        p.barcode === barcode || p.sku === barcode
      )
      if (product) {
        addToCart(product)
        setSearch('')
      }
    }, 80)
  }, [products, addToCart])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Enter: add first product
      if (e.key === 'Enter' && document.activeElement === searchRef.current) {
        e.preventDefault()
        if (filteredProducts.length > 0) {
          const p = filteredProducts[0]
          if (!p.track_inventory || getStock(p) > 0) addToCart(p)
        }
        return
      }
      // Escape: focus search
      if (e.key === 'Escape') {
        searchRef.current?.focus()
        setShowCustomerList(false)
        return
      }
      // F5: clear cart
      if (e.key === 'F5') {
        e.preventDefault()
        clearCart()
        return
      }
      // F10: checkout
      if (e.key === 'F10') {
        e.preventDefault()
        if (cart.length > 0 && !loading) handleCheckout()
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filteredProducts, cart, loading, addToCart, clearCart, getStock])

  const setPaymentAmount = (index: number, amount: number) => {
    setPayments(prev => prev.map((p, i) => i === index ? { ...p, amount } : p))
  }

  const addPaymentMethod = (method: 'cash' | 'card' | 'wallet' | 'credit') => {
    const label = PAYMENT_METHODS.find(m => m.value === method)?.label || method
    setPayments(prev => {
      const existing = prev.find(p => p.method === method)
      if (existing) return prev
      return [...prev, { method, amount: remaining, label }]
    })
  }

  const removePaymentMethod = (index: number) => {
    if (payments.length === 1) return
    setPayments(prev => prev.filter((_, i) => i !== index))
  }

  const handleCheckout = async () => {
    if (cart.length === 0 || loading) return
    if (remaining > 0 && payments[0].method !== 'credit') {
      const firstPay = payments[0]
      if (firstPay.amount === 0) {
        setPayments(prev => prev.map((p, i) => i === 0 ? { ...p, amount: total } : p))
      }
    }

    setLoading(true)
    setError(null)

    const finalPayments = payments.map(p => ({ ...p, amount: p.amount || 0 }))
    const paid = finalPayments.reduce((s, p) => s + p.amount, 0)
    const primaryMethod = finalPayments[0].method

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
            cost_price: i.product.cost_price || 0,
            discount_percent: i.discount_percent,
            tax_rate: i.tax_rate,
            tax_amount: i.tax_amount,
            total: i.total,
          })),
          subtotal,
          discount_percent: discountMode === 'percent' ? discountPercent : 0,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total,
          paid_amount: Math.min(paid, total + 0.01),
          payment_method: primaryMethod,
          notes,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'حدث خطأ')

      setReceipt({
        invoice_number: data.invoice_number,
        sale_id: data.sale_id,
        items: [...cart],
        subtotal,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total,
        paid_amount: paid,
        change_amount: Math.max(0, paid - total),
        customer_name: selectedCustomer?.name,
        date: new Date().toLocaleString('ar-SA'),
        payments: finalPayments.filter(p => p.amount > 0),
      })
      clearCart()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 overflow-hidden bg-muted/30">
      {/* ═══════════════ LEFT: Products ═══════════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search Bar */}
        <div className="bg-card border-b px-3 pt-3 pb-2 space-y-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder="ابحث بالاسم أو الباركود أو الكود... (Enter للإضافة)"
              className="w-full bg-background border border-input rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-medium"
              autoFocus
              dir="rtl"
            />
            {search && (
              <button onClick={() => { setSearch(''); searchRef.current?.focus() }} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Categories */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn('px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all',
                !selectedCategory ? 'bg-primary text-white shadow-sm' : 'bg-background border border-border hover:border-primary/50'
              )}
            >
              الكل
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className={cn('px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all',
                  selectedCategory === cat.id ? 'bg-primary text-white shadow-sm' : 'bg-background border border-border hover:border-primary/50'
                )}
              >
                {cat.name_ar || cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Package className="w-16 h-16 opacity-20" />
              <p className="text-sm font-medium">لا توجد منتجات مطابقة</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
              {filteredProducts.map(product => {
                const stock = getStock(product)
                const outOfStock = product.track_inventory && stock <= 0
                const inCart = cart.find(i => i.product.id === product.id)
                const catColor = (product.product_categories as any)?.color || '#6B7280'

                return (
                  <button
                    key={product.id}
                    onClick={() => !outOfStock && addToCart(product)}
                    className={cn(
                      'relative flex flex-col p-3 rounded-xl border text-right transition-all active:scale-95 group',
                      outOfStock
                        ? 'opacity-40 cursor-not-allowed bg-card border-border'
                        : inCart
                          ? 'bg-primary/5 border-primary shadow-sm hover:shadow-md'
                          : 'bg-card border-border hover:border-primary/40 hover:shadow-sm'
                    )}
                  >
                    {/* In-cart badge */}
                    {inCart && (
                      <div className="absolute top-2 left-2 min-w-[20px] h-5 bg-primary text-white rounded-full text-[10px] font-bold flex items-center justify-center px-1">
                        {inCart.quantity}
                      </div>
                    )}

                    {/* Category color strip */}
                    <div className="w-full h-1 rounded-full mb-2 opacity-60" style={{ backgroundColor: catColor }} />

                    {/* Product icon */}
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center mb-2 mx-auto">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>

                    <p className="text-xs font-semibold text-foreground line-clamp-2 mb-1 leading-tight">
                      {product.name_ar || product.name}
                    </p>

                    <p className="text-sm font-bold text-primary mt-auto">
                      {formatCurrency(product.sale_price, currency)}
                    </p>

                    {product.track_inventory && (
                      <p className={cn('text-[10px] mt-0.5', outOfStock ? 'text-red-500 font-medium' : stock <= (product.min_stock_level || 0) ? 'text-amber-500' : 'text-muted-foreground')}>
                        {outOfStock ? 'نفذ' : `${stock} وحدة`}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Bottom status bar */}
        <div className="bg-card border-t px-4 py-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>{filteredProducts.length} منتج</span>
          <button onClick={() => setShowShortcuts(true)} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Keyboard className="w-3 h-3" />
            اختصارات لوحة المفاتيح
          </button>
          <span>{cart.length} عنصر في السلة</span>
        </div>
      </div>

      {/* ═══════════════ RIGHT: Cart + Payment ═══════════════ */}
      <div className="w-[360px] xl:w-[400px] shrink-0 flex flex-col bg-card border-r shadow-xl">

        {/* Cart Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">السلة</span>
            {cart.length > 0 && (
              <span className="bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
                <Trash2 className="w-3 h-3" />
                مسح F5
              </button>
            )}
          </div>
        </div>

        {/* Customer Selector */}
        <div className="px-3 py-2 border-b relative">
          <div className="relative">
            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={selectedCustomer ? selectedCustomer.name : customerSearch}
              onChange={e => {
                setCustomerSearch(e.target.value)
                setSelectedCustomer(null)
                setShowCustomerList(true)
              }}
              onFocus={() => !selectedCustomer && setShowCustomerList(true)}
              placeholder="اختر عميلاً (اختياري)"
              className="w-full border border-input rounded-lg px-3 py-1.5 pr-8 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
            />
            {selectedCustomer && (
              <button onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }} className="absolute left-3 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
          {showCustomerList && !selectedCustomer && filteredCustomers.length > 0 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-card border rounded-xl shadow-xl z-20 max-h-36 overflow-y-auto">
              {filteredCustomers.slice(0, 6).map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c); setShowCustomerList(false); setCustomerSearch('') }}
                  className="w-full text-right px-3 py-2 text-xs hover:bg-accent flex justify-between items-center transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    {c.phone && <p className="text-muted-foreground">{c.phone}</p>}
                  </div>
                  {c.balance > 0 && <span className="text-red-500 font-medium">{formatCurrency(c.balance, currency)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <ShoppingCart className="w-14 h-14 opacity-10" />
              <p className="text-sm font-medium">السلة فارغة</p>
              <p className="text-xs opacity-60">اضغط على منتج أو امسح الباركود</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={item.product.id} className="bg-background rounded-xl p-2.5 border border-border/60">
                <div className="flex items-start justify-between gap-1 mb-2">
                  <p className="text-xs font-semibold text-foreground leading-tight flex-1 line-clamp-2">
                    {item.product.name_ar || item.product.name}
                  </p>
                  <button onClick={() => removeItem(item.product.id)} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 mt-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Quantity */}
                  <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0">
                    <button
                      onClick={() => updateQty(item.product.id, item.quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={e => updateQty(item.product.id, parseFloat(e.target.value) || 1)}
                      className="w-9 text-center text-xs font-bold bg-transparent border-x border-border h-7 focus:outline-none"
                      min="0.01"
                      step="1"
                    />
                    <button
                      onClick={() => updateQty(item.product.id, item.quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-green-50 hover:text-green-600 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Price */}
                  <span className="text-muted-foreground text-xs">×</span>
                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={e => updatePrice(item.product.id, parseFloat(e.target.value) || 0)}
                    className="w-16 text-center text-xs font-medium bg-background border border-border rounded-lg h-7 focus:outline-none focus:ring-1 focus:ring-primary/30 px-1"
                    step="0.01"
                    min="0"
                  />

                  {/* Total */}
                  <p className="text-sm font-bold text-primary mr-auto whitespace-nowrap">
                    {formatCurrency(item.total, currency)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ─── Payment Section ─── */}
        <div className="border-t bg-card">
          {/* Totals */}
          <div className="px-4 py-2 space-y-1 border-b">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>المجموع الجزئي</span>
              <span className="font-medium text-foreground">{formatCurrency(subtotal, currency)}</span>
            </div>

            {/* Discount row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDiscountMode(m => m === 'percent' ? 'fixed' : 'percent')}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                  title="تبديل نوع الخصم"
                >
                  {discountMode === 'percent' ? <Percent className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
                  خصم
                </button>
              </div>
              <div className="flex items-center gap-1">
                {discountMode === 'percent' ? (
                  <input
                    type="number"
                    min="0" max="100"
                    value={discountPercent || ''}
                    onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-14 text-center text-xs border border-border rounded-lg px-1 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30 bg-background"
                  />
                ) : (
                  <input
                    type="number"
                    min="0"
                    value={discountFixed || ''}
                    onChange={e => setDiscountFixed(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 text-center text-xs border border-border rounded-lg px-1 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30 bg-background"
                  />
                )}
                {discountAmount > 0 && (
                  <span className="text-xs text-red-500 font-medium">- {formatCurrency(discountAmount, currency)}</span>
                )}
              </div>
            </div>

            {taxAmount > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>الضريبة</span>
                <span>{formatCurrency(taxAmount, currency)}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-1 border-t border-dashed">
              <span className="font-bold text-sm">الإجمالي</span>
              <span className="font-bold text-xl text-primary">{formatCurrency(total, currency)}</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="px-3 py-2 space-y-2 border-b">
            {/* Method selector */}
            <div className="grid grid-cols-4 gap-1">
              {PAYMENT_METHODS.map(m => {
                const Icon = m.icon
                const active = payments.some(p => p.method === m.value)
                return (
                  <button
                    key={m.value}
                    onClick={() => addPaymentMethod(m.value)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-medium border transition-all',
                      active
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-border bg-background hover:border-primary/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                )
              })}
            </div>

            {/* Payment amounts */}
            {payments.map((pay, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">{pay.label}</span>
                  <input
                    type="number"
                    value={pay.amount || ''}
                    onChange={e => setPaymentAmount(idx, parseFloat(e.target.value) || 0)}
                    placeholder={remaining.toFixed(2)}
                    className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                    step="0.01"
                    min="0"
                  />
                  {payments.length > 1 && (
                    <button onClick={() => removePaymentMethod(idx)} className="text-muted-foreground hover:text-red-500 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {/* Quick amounts for cash */}
                {pay.method === 'cash' && (
                  <div className="grid grid-cols-6 gap-1">
                    {QUICK_AMOUNTS.map(v => (
                      <button
                        key={v}
                        onClick={() => setPaymentAmount(idx, v)}
                        className={cn(
                          'text-[10px] py-1 rounded-md text-center transition-all font-medium',
                          pay.amount === v
                            ? 'bg-primary text-white'
                            : 'bg-accent hover:bg-accent/80 text-foreground'
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Change / Remaining */}
            {cart.length > 0 && (
              <div className="flex gap-2">
                {remaining > 0.01 && (
                  <div className="flex-1 flex justify-between items-center bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-amber-700 dark:text-amber-400 font-medium">المتبقي</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(remaining, currency)}</span>
                  </div>
                )}
                {change > 0.01 && (
                  <div className="flex-1 flex justify-between items-center bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-green-700 dark:text-green-400 font-medium">الباقي للعميل</span>
                    <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(change, currency)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="px-3 py-2 border-b">
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="ملاحظات..."
              className="w-full border border-input rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mx-3 my-2 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 text-xs p-2.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Checkout Button */}
          <div className="p-3">
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || loading}
              className={cn(
                'w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg',
                cart.length > 0 && !loading
                  ? 'bg-primary text-white hover:bg-primary/90 active:scale-[0.98]'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  إتمام البيع · {formatCurrency(total, currency)}
                  <span className="text-white/60 text-[10px] font-normal mr-1">F10</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════ RECEIPT MODAL ═══════════════ */}
      {receipt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            {/* Receipt Header */}
            <div className="text-center py-6 px-4 border-b border-dashed">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="font-bold text-lg text-foreground">{companyName}</h2>
              <p className="text-xs text-muted-foreground mt-1">{receipt.date}</p>
              <p className="font-mono text-sm font-bold text-primary mt-2 bg-primary/10 px-3 py-1 rounded-full inline-block">
                {receipt.invoice_number}
              </p>
              {receipt.customer_name && (
                <p className="text-xs text-muted-foreground mt-2">العميل: {receipt.customer_name}</p>
              )}
            </div>

            {/* Items */}
            <div className="px-4 py-3 border-b border-dashed space-y-2">
              {receipt.items.map((item, i) => (
                <div key={i} className="flex justify-between items-start text-xs">
                  <div className="flex-1 text-right ml-2">
                    <p className="font-medium">{item.product.name_ar || item.product.name}</p>
                    <p className="text-muted-foreground">{item.quantity} × {formatCurrency(item.unit_price, currency)}</p>
                  </div>
                  <span className="font-bold whitespace-nowrap">{formatCurrency(item.total, currency)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="px-4 py-3 border-b border-dashed space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>{formatCurrency(receipt.subtotal, currency)}</span>
                <span>المجموع</span>
              </div>
              {receipt.discount_amount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>- {formatCurrency(receipt.discount_amount, currency)}</span>
                  <span>خصم</span>
                </div>
              )}
              {receipt.tax_amount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{formatCurrency(receipt.tax_amount, currency)}</span>
                  <span>ضريبة</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t pt-1 mt-1">
                <span>{formatCurrency(receipt.total, currency)}</span>
                <span>الإجمالي</span>
              </div>
            </div>

            {/* Payment */}
            <div className="px-4 py-3 border-b border-dashed space-y-1 text-xs">
              {receipt.payments.map((p, i) => (
                <div key={i} className="flex justify-between text-muted-foreground">
                  <span>{formatCurrency(p.amount, currency)}</span>
                  <span>{p.label}</span>
                </div>
              ))}
              {receipt.change_amount > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>{formatCurrency(receipt.change_amount, currency)}</span>
                  <span>المبلغ المُرجَع</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center py-3 text-xs text-muted-foreground border-b border-dashed">
              شكراً لزيارتكم ♦ {companyName}
            </div>

            {/* Actions */}
            <div className="p-4 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Printer className="w-4 h-4" />
                طباعة
              </button>
              <button
                onClick={() => { setReceipt(null); searchRef.current?.focus() }}
                className="flex-1 flex items-center justify-center gap-2 bg-accent text-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-accent/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                فاتورة جديدة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ SHORTCUTS MODAL ═══════════════ */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">
              <Keyboard className="w-4 h-4" />
              اختصارات لوحة المفاتيح
            </h3>
            <div className="space-y-2.5 text-sm">
              {[
                ['Enter', 'إضافة أول منتج في النتائج'],
                ['F5', 'مسح السلة'],
                ['F10', 'إتمام البيع'],
                ['Escape', 'التركيز على البحث'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground text-xs">{desc}</span>
                  <kbd className="bg-muted px-2 py-0.5 rounded text-xs font-mono font-bold shrink-0">{key}</kbd>
                </div>
              ))}
            </div>
            <button onClick={() => setShowShortcuts(false)} className="mt-4 w-full bg-primary text-white py-2 rounded-lg text-sm font-medium">
              حسناً
            </button>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-print, .receipt-print * { visibility: visible; }
          .receipt-print { position: fixed; top: 0; left: 0; width: 80mm; }
        }
      `}</style>
    </div>
  )
}
