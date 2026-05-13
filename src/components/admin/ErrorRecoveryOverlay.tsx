'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  AlertTriangle, Wifi, WifiOff, RefreshCw, RefreshCcw,
  CloudOff, ServerOff, Clock, Loader2, CheckCircle2,
  ArrowLeft, ArrowRight, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type ConnectionState = 'connected' | 'disconnected' | 'reconnecting' | 'offline'

interface ReconnectEvent extends CustomEvent {
  detail: { attempt: number; maxAttempts: number }
}

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_INTERVAL = 5000

export function ErrorRecoveryOverlay() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected')
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [isOnline, setIsOnline] = useState(true)
  const [showRecoveryToast, setShowRecoveryToast] = useState(false)
  const [staleData, setStaleData] = useState(false)
  const [hasCachedData, setHasCachedData] = useState(false)

  const startCountdown = useCallback((seconds: number) => {
    setCountdown(seconds)
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const attemptReconnect = useCallback(() => {
    setConnectionState('reconnecting')
    setReconnectAttempt(prev => prev + 1)
    startCountdown(Math.ceil(RECONNECT_INTERVAL / 1000))

    const event = new CustomEvent('app:reconnect-attempt', {
      detail: { attempt: reconnectAttempt + 1, maxAttempts: MAX_RECONNECT_ATTEMPTS },
    })
    window.dispatchEvent(event)
  }, [reconnectAttempt, startCountdown])

  const goOffline = useCallback(() => {
    setConnectionState('offline')
    setHasCachedData(true)
    const event = new CustomEvent('app:offline-mode', { detail: { enabled: true } })
    window.dispatchEvent(event)
  }, [])

  const handleReconnectSuccess = useCallback(() => {
    setConnectionState('connected')
    setReconnectAttempt(0)
    setCountdown(0)
    setStaleData(false)
    setShowRecoveryToast(true)
    setTimeout(() => setShowRecoveryToast(false), 4000)
  }, [])

  const handleStaleData = useCallback(() => {
    setStaleData(true)
  }, [])

  const refreshData = useCallback(() => {
    const event = new CustomEvent('app:refresh-data')
    window.dispatchEvent(event)
    setStaleData(false)
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (connectionState === 'offline') {
        attemptReconnect()
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setConnectionState('offline')
    }

    const handleDisconnect = () => {
      setConnectionState('disconnected')
      attemptReconnect()
    }

    const handleReconnectSuccessEvent = () => {
      handleReconnectSuccess()
    }

    const handleReconnectFailed = () => {
      if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
        setConnectionState('offline')
        setHasCachedData(true)
      } else {
        attemptReconnect()
      }
    }

    const handleStaleDataEvent = () => {
      handleStaleData()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('app:realtime-disconnected', handleDisconnect)
    window.addEventListener('app:realtime-connected', handleReconnectSuccessEvent)
    window.addEventListener('app:reconnect-failed', handleReconnectFailed)
    window.addEventListener('app:stale-data', handleStaleDataEvent)

    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('app:realtime-disconnected', handleDisconnect)
      window.removeEventListener('app:realtime-connected', handleReconnectSuccessEvent)
      window.removeEventListener('app:reconnect-failed', handleReconnectFailed)
      window.removeEventListener('app:stale-data', handleStaleDataEvent)
    }
  }, [attemptReconnect, handleReconnectSuccess, reconnectAttempt])

  const handleManualReconnect = () => {
    setReconnectAttempt(0)
    attemptReconnect()
  }

  if (connectionState === 'connected' && !staleData && isOnline) {
    return (
      <>
        {showRecoveryToast && (
          <div
            className={cn(
              'fixed bottom-6 left-6 z-[9999]',
              'animate-in slide-in-from-bottom-4 fade-in duration-300'
            )}
          >
            <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 shadow-lg px-5 py-3.5">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-green-800">تمت إعادة الاتصال بنجاح</span>
              <button
                onClick={() => setShowRecoveryToast(false)}
                className="mr-2 text-green-400 hover:text-green-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {!isOnline && (
          <div className="fixed top-4 left-4 z-[9999]">
            <div className="flex items-center gap-2 rounded-xl bg-yellow-50 border border-yellow-200 shadow-sm px-4 py-2">
              <WifiOff className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">وضع عدم الاتصال</span>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {showRecoveryToast && (
        <div
          className={cn(
            'fixed bottom-6 left-6 z-[9999]',
            'animate-in slide-in-from-bottom-4 fade-in duration-300'
          )}
        >
          <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 shadow-lg px-5 py-3.5">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-green-800">تمت إعادة الاتصال بنجاح</span>
            <button
              onClick={() => setShowRecoveryToast(false)}
              className="mr-2 text-green-400 hover:text-green-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {staleData && connectionState === 'connected' && isOnline && (
        <div
          className={cn(
            'fixed top-0 left-0 right-0 z-[9999]',
            'animate-in slide-in-from-top-2 fade-in duration-300'
          )}
        >
          <div className="flex items-center justify-center gap-3 bg-yellow-50 border-b border-yellow-200 px-5 py-2.5">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">قد تكون البيانات غير محدثة</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshData}
              className="text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100"
            >
              <RefreshCw className="h-3.5 w-3.5 ml-1" />
              تحديث
            </Button>
          </div>
        </div>
      )}

      {(connectionState === 'disconnected' || connectionState === 'reconnecting') && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div
            className={cn(
              'bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center',
              'animate-in zoom-in-95 fade-in duration-300'
            )}
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-red-50">
                <ServerOff className="h-12 w-12 text-red-500" />
              </div>
            </div>

            <h2 className="text-xl font-bold mb-2">انقطع الاتصال بالخادم</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {connectionState === 'reconnecting'
                ? 'جاري إعادة الاتصال...'
                : 'حدث خطأ في الاتصال بالخادم. نحاول إعادة الاتصال تلقائياً.'}
            </p>

            {connectionState === 'reconnecting' && (
              <div className="flex flex-col items-center gap-3 mb-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>إعادة المحاولة خلال {countdown} ثوان</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: MAX_RECONNECT_ATTEMPTS }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1.5 w-6 rounded-full transition-all',
                        i < reconnectAttempt ? 'bg-red-400' : i === reconnectAttempt ? 'bg-primary animate-pulse' : 'bg-gray-200'
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {connectionState === 'disconnected' && (
              <div className="flex flex-col gap-3 mb-6">
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleManualReconnect}
                  className="w-full"
                >
                  <RefreshCcw className="h-4 w-4 ml-2" />
                  إعادة الاتصال
                </Button>
              </div>
            )}

            {connectionState === 'reconnecting' && (
              <Button
                variant="outline"
                size="lg"
                onClick={handleManualReconnect}
                className="w-full mb-3"
              >
                <RefreshCw className="h-4 w-4 ml-2" />
                إعادة المحاولة يدوياً
              </Button>
            )}

            <button
              onClick={goOffline}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
              <CloudOff className="h-3.5 w-3.5 inline ml-1" />
              العمل في وضع عدم الاتصال
            </button>
          </div>
        </div>
      )}

      {connectionState === 'offline' && (
        <div className="fixed top-4 left-4 z-[9999]">
          <div className="flex items-center gap-2 rounded-xl bg-yellow-50 border border-yellow-200 shadow-sm px-4 py-2">
            <WifiOff className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">وضع عدم الاتصال</span>
            {hasCachedData && (
              <span className="text-xs text-yellow-600 mr-2">(بيانات مخزنة مؤقتاً)</span>
            )}
          </div>
        </div>
      )}
    </>
  )
}
