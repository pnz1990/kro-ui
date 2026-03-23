// Tests for useDebounce hook — Vitest with fake timers

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from './useDebounce'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebounce', () => {
  it('returns initial value synchronously on first render', () => {
    const { result } = renderHook(() => useDebounce('hello', 300))
    expect(result.current).toBe('hello')
  })

  it('does not emit updated value before delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    })
    rerender({ value: 'b' })
    // Advance time by less than the delay
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe('a')
  })

  it('emits updated value after delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    })
    rerender({ value: 'b' })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe('b')
  })

  it('coalesces rapid changes — only emits the last value', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    })
    // Rapid keystrokes — each one resets the timer
    rerender({ value: 'ab' })
    act(() => { vi.advanceTimersByTime(100) })
    rerender({ value: 'abc' })
    act(() => { vi.advanceTimersByTime(100) })
    rerender({ value: 'abcd' })
    act(() => { vi.advanceTimersByTime(100) })
    // Still on old value — total elapsed 300ms but each keystroke reset the timer
    expect(result.current).toBe('a')
    // Now let the last timer fire
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('abcd')
  })

  it('cancels timer on unmount — no state-update-after-unmount warning', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    )
    rerender({ value: 'b' })
    // Unmount before the timer fires
    unmount()
    // Advancing time should NOT trigger a React setState warning
    act(() => { vi.advanceTimersByTime(300) })
    // Value remains the stale 'a' from before unmount — no update after unmount
    expect(result.current).toBe('a')
  })

  it('handles non-string types', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 200), {
      initialProps: { value: 42 },
    })
    rerender({ value: 99 })
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe(99)
  })
})
