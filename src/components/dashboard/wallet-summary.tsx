'use client'

import Link from 'next/link'
import { Wallet, Building2, Smartphone, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Wallet as WalletType } from '@/types/database'

interface WalletSummaryProps {
  wallets: WalletType[]
  currency: string
}

const walletIcons = {
  cash: Wallet,
  bank: Building2,
  digital: Smartphone,
}

const walletColors = {
  cash: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
  bank: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30',
  digital: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30',
}

export function WalletSummary({ wallets, currency }: WalletSummaryProps) {
  const totalBalance = wallets.reduce((s, w) => s + Number(w.current_balance), 0)

  return (
    <div className="bg-card rounded-xl border shadow-sm h-full">
      {/* Header */}
      <div className="p-5 border-b">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-foreground">الصندوق</h3>
          <Link href="/dashboard/wallet" className="text-xs text-primary hover:underline font-medium">
            إدارة
          </Link>
        </div>
        <p className="text-2xl font-bold text-foreground mt-2">
          {formatCurrency(totalBalance, currency)}
        </p>
        <p className="text-xs text-muted-foreground">إجمالي الأرصدة</p>
      </div>

      {/* Wallets List */}
      <div className="p-4 space-y-2">
        {wallets.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">لا توجد محافظ</p>
          </div>
        ) : (
          wallets.slice(0, 4).map((wallet) => {
            const Icon = walletIcons[wallet.type] || Wallet
            const colorClass = walletColors[wallet.type] || walletColors.cash

            return (
              <div
                key={wallet.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {wallet.name_ar || wallet.name}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {wallet.type === 'cash' ? 'نقدي' : wallet.type === 'bank' ? 'بنكي' : 'رقمي'}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground shrink-0">
                  {formatCurrency(wallet.current_balance, wallet.currency)}
                </p>
              </div>
            )
          })
        )}

        <Link
          href="/dashboard/wallet"
          className="flex items-center justify-center gap-2 w-full p-2.5 rounded-lg border border-dashed border-border hover:border-primary hover:text-primary text-muted-foreground text-sm transition-colors mt-2"
        >
          <Plus className="w-4 h-4" />
          إضافة محفظة
        </Link>
      </div>
    </div>
  )
}
