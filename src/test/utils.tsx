import React, { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

function AllTheProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllTheProviders, ...options })
}

export * from '@testing-library/react'
export { customRender as render, describe, it, expect, vi, beforeEach, afterEach }
