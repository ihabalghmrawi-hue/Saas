'use client'

import { useState, useCallback } from 'react'
import type { ValidationMessage } from '@/lib/workbench/types'

export interface UseValidationOptions {
  onValid?: () => void
  onInvalid?: (messages: ValidationMessage[]) => void
}

export interface UseValidationResult {
  messages: ValidationMessage[]
  isValid: boolean
  hasErrors: boolean
  hasWarnings: boolean
  validate: (newMessages: ValidationMessage[]) => void
  clear: () => void
  dismiss: (id: string) => void
  dismissAll: (type?: 'error' | 'warning' | 'info') => void
}

export function useValidation(options?: UseValidationOptions): UseValidationResult {
  const [messages, setMessages] = useState<ValidationMessage[]>([])

  const isValid = messages.length === 0
  const hasErrors = messages.some(m => m.type === 'error')
  const hasWarnings = messages.some(m => m.type === 'warning')

  const validate = useCallback(
    (newMessages: ValidationMessage[]) => {
      setMessages(prev => {
        const existingFields = new Set(prev.map(m => m.field).filter(Boolean))

        const dedupedNew = newMessages.filter(
          nm => !nm.field || !existingFields.has(nm.field)
        )

        const merged = [...prev, ...dedupedNew]

        const errorMessages = merged.filter(m => m.type === 'error')
        if (errorMessages.length > 0) {
          options?.onInvalid?.(errorMessages)
        } else {
          options?.onValid?.()
        }

        return merged
      })
    },
    [options]
  )

  const clear = useCallback(() => {
    setMessages([])
  }, [])

  const dismiss = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
  }, [])

  const dismissAll = useCallback((type?: 'error' | 'warning' | 'info') => {
    if (!type) {
      setMessages([])
      return
    }
    setMessages(prev => prev.filter(m => m.type !== type))
  }, [])

  return {
    messages,
    isValid,
    hasErrors,
    hasWarnings,
    validate,
    clear,
    dismiss,
    dismissAll,
  }
}
