'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 5000

type ToastVariant = 'default' | 'destructive' | 'success'

type ToasterToast = {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

type Action =
  | { type: 'ADD_TOAST'; toast: ToasterToast }
  | { type: 'DISMISS_TOAST'; toastId: string }
  | { type: 'REMOVE_TOAST'; toastId: string }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function addToRemoveQueue(toastId: string, duration: number = TOAST_REMOVE_DELAY) {
  if (toastTimeouts.has(toastId)) return

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: 'REMOVE_TOAST', toastId })
  }, duration)

  toastTimeouts.set(toastId, timeout)
}

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }
    case 'DISMISS_TOAST': {
      const { toastId } = action
      const toast = state.toasts.find((t) => t.id === toastId)
      if (toast) {
        addToRemoveQueue(toastId, toast.duration)
      }
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId ? { ...t } : t
        ),
      }
    }
    case 'REMOVE_TOAST':
      if (state.toasts.some((t) => t.id === action.toastId)) {
        return {
          ...state,
          toasts: state.toasts.filter((t) => t.id !== action.toastId),
        }
      }
      return state
  }
}

const listeners: Array<(state: State) => void> = []
let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

function toast({ title, description, variant = 'default', duration }: Omit<ToasterToast, 'id'>) {
  const id = genId()
  dispatch({
    type: 'ADD_TOAST',
    toast: { id, title, description, variant, duration },
  })
  addToRemoveQueue(id, duration)
  return id
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (toastId: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  }
}

type ToastActionElement = React.ReactElement

export type { ToasterToast, ToastActionElement, ToastVariant }
export { toast, useToast }
