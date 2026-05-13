import { expect, afterEach, vi } from 'vitest'

afterEach(() => {
  // Cleanup after each test — add RTL cleanup when installed
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock next/headers (async in Next.js 16)
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}))
