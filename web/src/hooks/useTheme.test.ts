// Copyright 2026 The Kubernetes Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

// ── helpers ──────────────────────────────────────────────────────────────

let mediaQueryListeners: ((e: MediaQueryListEvent) => void)[] = []

function makeMockMediaQuery(matches: boolean) {
  return {
    matches,
    addEventListener: vi.fn((_: string, fn: (e: MediaQueryListEvent) => void) => {
      mediaQueryListeners.push(fn)
    }),
    removeEventListener: vi.fn((_: string, fn: (e: MediaQueryListEvent) => void) => {
      mediaQueryListeners = mediaQueryListeners.filter((l) => l !== fn)
    }),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    media: '(prefers-color-scheme: light)',
  }
}

function fireMediaChange(matches: boolean) {
  for (const l of mediaQueryListeners) {
    l({ matches } as MediaQueryListEvent)
  }
}

// ── test setup ───────────────────────────────────────────────────────────

describe('useTheme', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    mediaQueryListeners = []
    localStorage.clear()
    // Remove any data-theme attribute set by previous tests
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
  })

  // ── dark OS, no override ──────────────────────────────────────────────

  describe('dark OS preference, no localStorage override', () => {
    beforeEach(() => {
      window.matchMedia = vi.fn().mockReturnValue(makeMockMediaQuery(false))
    })

    it('returns dark as the initial theme', () => {
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('dark')
    })

    it('does not set data-theme attribute (dark is the CSS default)', () => {
      renderHook(() => useTheme())
      expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    })

    it('hasOverride is false', () => {
      const { result } = renderHook(() => useTheme())
      expect(result.current.hasOverride).toBe(false)
    })
  })

  // ── light OS, no override ─────────────────────────────────────────────

  describe('light OS preference, no localStorage override', () => {
    beforeEach(() => {
      window.matchMedia = vi.fn().mockReturnValue(makeMockMediaQuery(true))
    })

    it('returns light as the initial theme', () => {
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('light')
    })

    it('sets data-theme="light" on <html>', () => {
      renderHook(() => useTheme())
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('hasOverride is false', () => {
      const { result } = renderHook(() => useTheme())
      expect(result.current.hasOverride).toBe(false)
    })
  })

  // ── localStorage override ─────────────────────────────────────────────

  describe('localStorage override', () => {
    beforeEach(() => {
      window.matchMedia = vi.fn().mockReturnValue(makeMockMediaQuery(false)) // dark OS
    })

    it('uses stored "light" override even with dark OS preference', () => {
      localStorage.setItem('kro-ui-theme', 'light')
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      expect(result.current.hasOverride).toBe(true)
    })

    it('uses stored "dark" override', () => {
      localStorage.setItem('kro-ui-theme', 'dark')
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBeNull()
      expect(result.current.hasOverride).toBe(true)
    })
  })

  // ── setTheme ──────────────────────────────────────────────────────────

  describe('setTheme', () => {
    beforeEach(() => {
      window.matchMedia = vi.fn().mockReturnValue(makeMockMediaQuery(false)) // dark OS
    })

    it('setTheme("light") applies light theme and persists to localStorage', () => {
      const { result } = renderHook(() => useTheme())
      act(() => result.current.setTheme('light'))
      expect(result.current.theme).toBe('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      expect(localStorage.getItem('kro-ui-theme')).toBe('light')
      expect(result.current.hasOverride).toBe(true)
    })

    it('setTheme("dark") applies dark theme and persists to localStorage', () => {
      localStorage.setItem('kro-ui-theme', 'light')
      const { result } = renderHook(() => useTheme())
      act(() => result.current.setTheme('dark'))
      expect(result.current.theme).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBeNull()
      expect(localStorage.getItem('kro-ui-theme')).toBe('dark')
    })

    it('setTheme(null) removes override and reverts to OS preference', () => {
      localStorage.setItem('kro-ui-theme', 'light')
      const { result } = renderHook(() => useTheme())
      act(() => result.current.setTheme(null))
      expect(result.current.theme).toBe('dark') // OS is dark
      expect(localStorage.getItem('kro-ui-theme')).toBeNull()
      expect(result.current.hasOverride).toBe(false)
    })
  })

  // ── OS change event ───────────────────────────────────────────────────

  describe('OS preference change events', () => {
    it('updates theme when OS switches to light (no override)', () => {
      window.matchMedia = vi.fn().mockReturnValue(makeMockMediaQuery(false)) // dark
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('dark')

      act(() => fireMediaChange(true)) // OS switches to light
      expect(result.current.theme).toBe('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('updates theme when OS switches to dark (no override)', () => {
      window.matchMedia = vi.fn().mockReturnValue(makeMockMediaQuery(true)) // light
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('light')

      act(() => fireMediaChange(false)) // OS switches to dark
      expect(result.current.theme).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    })

    it('ignores OS change when a manual override is active', () => {
      window.matchMedia = vi.fn().mockReturnValue(makeMockMediaQuery(false)) // dark
      localStorage.setItem('kro-ui-theme', 'light')
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe('light')

      act(() => fireMediaChange(false)) // OS says dark, but override is light
      expect(result.current.theme).toBe('light') // unchanged
    })
  })

  // ── cleanup ───────────────────────────────────────────────────────────

  it('removes the media query listener on unmount', () => {
    const mockMq = makeMockMediaQuery(false)
    window.matchMedia = vi.fn().mockReturnValue(mockMq)
    const { unmount } = renderHook(() => useTheme())
    unmount()
    expect(mockMq.removeEventListener).toHaveBeenCalledTimes(1)
  })
})
