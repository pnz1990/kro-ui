// Tests for usePageTitle hook
// Verifies document.title is set correctly on mount and reset on unmount.
// Constitution §XIII: every page MUST update document.title in the format
// "<content> — kro-ui" (or just "kro-ui" for the home page).

import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePageTitle } from './usePageTitle'

afterEach(() => {
  // Reset to a clean state between tests
  document.title = 'kro-ui'
})

describe('usePageTitle', () => {
  it('sets document.title to "<title> — kro-ui" when title is non-empty', () => {
    renderHook(() => usePageTitle('RGDs'))
    expect(document.title).toBe('RGDs — kro-ui')
  })

  it('sets document.title to "kro-ui" when title is empty string', () => {
    renderHook(() => usePageTitle(''))
    expect(document.title).toBe('kro-ui')
  })

  it('updates document.title when title prop changes', () => {
    const { rerender } = renderHook(({ title }: { title: string }) => usePageTitle(title), {
      initialProps: { title: 'Overview' },
    })
    expect(document.title).toBe('Overview — kro-ui')

    rerender({ title: 'Catalog' })
    expect(document.title).toBe('Catalog — kro-ui')
  })

  it('resets document.title to "kro-ui" on unmount', () => {
    const { unmount } = renderHook(() => usePageTitle('Instance Detail'))
    expect(document.title).toBe('Instance Detail — kro-ui')

    unmount()
    expect(document.title).toBe('kro-ui')
  })

  it('handles a title with special characters', () => {
    renderHook(() => usePageTitle('my-rgd / details'))
    expect(document.title).toBe('my-rgd / details — kro-ui')
  })
})
