import { expect, vi, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

afterEach(cleanup)

expect.extend(matchers)

// jsdom doesn't implement localStorage — stub with DE locale pinned for tests
const store: Record<string, string> = { 'usdx-locale': 'de' }
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
  },
  writable: true,
})
