'use client'

import { useEffect } from 'react'

export default function InventoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Inventory page error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-2xl p-6 max-w-2xl w-full">
        <h2 className="text-lg font-bold text-red-700 mb-2">حدث خطأ في صفحة المنتجات</h2>
        <p className="text-sm text-red-600 font-mono bg-red-100 dark:bg-red-900/30 p-3 rounded-lg break-all">
          {error.message || 'Unknown error'}
        </p>
        {error.stack && (
          <pre className="text-xs text-red-500 mt-3 overflow-auto max-h-48 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">
            {error.stack}
          </pre>
        )}
        <button
          onClick={reset}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  )
}
