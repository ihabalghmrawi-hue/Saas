'use client'

import { useEffect } from 'react'
import { useGlobalWorkspaceActions } from '@/lib/workspace/provider'

export function useKeyboardShortcuts() {
  const {
    openCommandPalette,
    openSearch,
    toggleActivityCenter,
    toggleNotificationCenter,
    state,
  } = useGlobalWorkspaceActions()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 'k') { e.preventDefault(); openCommandPalette() }
      if (meta && e.key === 'f' && e.shiftKey) { e.preventDefault(); openSearch() }
      if (meta && e.key === 'a') { e.preventDefault(); toggleActivityCenter() }
      if (meta && e.key === 'n') { e.preventDefault(); toggleNotificationCenter() }
      if (e.key === 'Escape') {
        if (state.commandPalette.open) openCommandPalette()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openCommandPalette, openSearch, toggleActivityCenter, toggleNotificationCenter, state.commandPalette.open])
}
