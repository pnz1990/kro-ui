// Tests for useVirtualGrid hook — pure arithmetic, no DOM needed

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVirtualGrid } from './useVirtualGrid'

// BASE uses rowGap:0 so existing arithmetic tests are unchanged.
// Gap-aware tests use rowGap:16 to match the real CSS grid gap.
const BASE = {
  itemHeight: 130,
  containerHeight: 600,
  scrollTop: 0,
  overscan: 2,
  rowGap: 0,
}

describe('useVirtualGrid', () => {
  it('returns zero state for itemCount=0', () => {
    const { result } = renderHook(() =>
      useVirtualGrid({ ...BASE, itemCount: 0, cols: 3 }),
    )
    expect(result.current).toEqual({
      firstIndex: 0,
      lastIndex: 0,
      offsetTop: 0,
      offsetBottom: 0,
      totalHeight: 0,
    })
  })

  it('handles itemCount=1 (single item, single row)', () => {
    const { result } = renderHook(() =>
      useVirtualGrid({ ...BASE, itemCount: 1, cols: 3 }),
    )
    expect(result.current.firstIndex).toBe(0)
    expect(result.current.lastIndex).toBe(1)
    expect(result.current.totalHeight).toBe(130)
    expect(result.current.offsetTop).toBe(0)
    expect(result.current.offsetBottom).toBe(0)
  })

  it('renders first window at scrollTop=0 with overscan', () => {
    // containerHeight=600, itemHeight=130 → visibleRows = ceil(600/130) = 5
    // with overscan=2: rows 0..(5+2)=7, i.e. 7 rows rendered
    const { result } = renderHook(() =>
      useVirtualGrid({ ...BASE, itemCount: 100, cols: 3, scrollTop: 0 }),
    )
    expect(result.current.firstIndex).toBe(0)
    // firstRow=0, lastRow = min(33-1, 0+5+2) = min(32, 7) = 7
    // lastIndex = min(100, (7+1)*3) = min(100, 24) = 24
    expect(result.current.lastIndex).toBe(24)
    expect(result.current.offsetTop).toBe(0)
    expect(result.current.totalHeight).toBe(Math.ceil(100 / 3) * 130)
  })

  it('correctly windows the mid-list scroll position', () => {
    // scrollTop = 1300px → firstVisibleRow = floor(1300/130) = 10
    // firstRow = max(0, 10-2) = 8
    // lastRow = min(33-1, 10+5+2) = min(32, 17) = 17
    // firstIndex = 8*3 = 24
    // lastIndex = min(100, (17+1)*3) = min(100, 54) = 54
    const { result } = renderHook(() =>
      useVirtualGrid({ ...BASE, itemCount: 100, cols: 3, scrollTop: 1300 }),
    )
    expect(result.current.firstIndex).toBe(24)
    expect(result.current.lastIndex).toBe(54)
    expect(result.current.offsetTop).toBe(8 * 130)
  })

  it('clamps lastIndex to itemCount at the bottom', () => {
    // Scroll all the way to the bottom
    const totalRows = Math.ceil(100 / 3) // = 34
    const scrollTop = (totalRows - 1) * 130
    const { result } = renderHook(() =>
      useVirtualGrid({ ...BASE, itemCount: 100, cols: 3, scrollTop }),
    )
    expect(result.current.lastIndex).toBe(100)
  })

  it('degenerates to a simple list when cols=1', () => {
    const { result } = renderHook(() =>
      useVirtualGrid({ ...BASE, itemCount: 50, cols: 1, scrollTop: 0 }),
    )
    // totalRows=50, visibleRows=ceil(600/130)=5, lastRow=5+2=7
    // lastIndex = min(50, 8*1) = 8
    expect(result.current.firstIndex).toBe(0)
    expect(result.current.lastIndex).toBe(8)
    expect(result.current.totalHeight).toBe(50 * 130)
  })

  it('groups items correctly when cols=10', () => {
    // 100 items, 10 cols → 10 rows total
    // visibleRows = ceil(600/130) = 5; with overscan=2 → lastRow = min(9, 0+5+2) = 7
    // lastIndex = min(100, (7+1)*10) = min(100, 80) = 80
    const { result } = renderHook(() =>
      useVirtualGrid({ ...BASE, itemCount: 100, cols: 10, scrollTop: 0 }),
    )
    expect(result.current.firstIndex).toBe(0)
    expect(result.current.lastIndex).toBe(80)
    expect(result.current.totalHeight).toBe(10 * 130)
  })

  it('totalHeight invariant: ceil(itemCount/cols)*itemHeight (no gap)', () => {
    for (const [itemCount, cols] of [[5000, 3], [5000, 4], [7, 3], [1, 1]] as [number, number][]) {
      const { result } = renderHook(() =>
        useVirtualGrid({ ...BASE, itemCount, cols, scrollTop: 0 }),
      )
      expect(result.current.totalHeight).toBe(Math.ceil(itemCount / cols) * 130)
    }
  })

  it('offsetTop + rendered rows height + offsetBottom ≈ totalHeight', () => {
    const { result } = renderHook(() =>
      useVirtualGrid({ ...BASE, itemCount: 100, cols: 3, scrollTop: 650 }),
    )
    const { firstIndex, lastIndex, offsetTop, offsetBottom, totalHeight } = result.current
    const renderedRows = Math.ceil((lastIndex - firstIndex) / 3)
    // Allow ≤1 row of rounding at the partial last row
    expect(offsetTop + renderedRows * 130 + offsetBottom).toBeGreaterThanOrEqual(totalHeight - 130)
    expect(offsetTop + renderedRows * 130 + offsetBottom).toBeLessThanOrEqual(totalHeight + 130)
  })

  // ── Gap-aware tests (rowGap=16, matching the real CSS grid) ──────────────────
  // These cover the GH #397 bug: offsetTop/totalHeight were missing the row gap,
  // causing the 3rd and subsequent rows to render 32px (2×gap) too high.

  describe('with rowGap=16 (real CSS grid gap)', () => {
    const GAP_BASE = { ...BASE, itemHeight: 178, rowGap: 16, containerHeight: 800 }

    it('totalHeight includes gaps between rows', () => {
      // 9 items, 3 cols → 3 rows. totalHeight = 3*178 + 2*16 = 534+32 = 566
      const { result } = renderHook(() =>
        useVirtualGrid({ ...GAP_BASE, itemCount: 9, cols: 3, scrollTop: 0 }),
      )
      expect(result.current.totalHeight).toBe(3 * 178 + 2 * 16) // 566
    })

    it('single row has no trailing gap', () => {
      // 3 items, 3 cols → 1 row. totalHeight = 178 (no gap needed)
      const { result } = renderHook(() =>
        useVirtualGrid({ ...GAP_BASE, itemCount: 3, cols: 3, scrollTop: 0 }),
      )
      expect(result.current.totalHeight).toBe(178)
    })

    it('offsetTop for row 2 accounts for gap (GH #397 regression)', () => {
      // 32 items, 3 cols → ceil(32/3)=11 rows. rowStride = 178+16 = 194.
      // At scrollTop=0, overscan=2: firstRow=0, visible rows = ceil(800/194)=5,
      // lastRow=min(10, 0+5+2)=7. So row 2 (index 2) IS in the window.
      // When row 2 is the first rendered row (scrolled past rows 0+1):
      // offsetTop should be 2 * 194 = 388, not 2 * 178 = 356.
      const rowStride = 178 + 16 // 194
      const { result } = renderHook(() =>
        useVirtualGrid({ ...GAP_BASE, itemCount: 32, cols: 3, scrollTop: 2 * rowStride }),
      )
      // firstVisibleRow = floor(388/194) = 2
      // firstRow = max(0, 2-2) = 0
      // offsetTop = 0 * 194 = 0
      expect(result.current.offsetTop).toBe(0)

      // Now scroll past overscan to force row 2 to be the first rendered row
      const { result: result2 } = renderHook(() =>
        useVirtualGrid({ ...GAP_BASE, itemCount: 32, cols: 3, scrollTop: 4 * rowStride + 1 }),
      )
      // firstVisibleRow = floor((4*194+1)/194) = 4
      // firstRow = max(0, 4-2) = 2
      // offsetTop = 2 * 194 = 388
      expect(result2.current.offsetTop).toBe(2 * rowStride) // 388, not 356
    })

    it('offsetTop+rendered+offsetBottom equals totalHeight with gap', () => {
      const rowStride = 178 + 16
      const { result } = renderHook(() =>
        useVirtualGrid({ ...GAP_BASE, itemCount: 32, cols: 3, scrollTop: 3 * rowStride }),
      )
      const { firstIndex, lastIndex, offsetTop, offsetBottom, totalHeight } = result.current
      const renderedRows = Math.ceil((lastIndex - firstIndex) / 3)
      const renderedHeight = renderedRows * rowStride
      // offsetTop + rendered + offsetBottom should equal totalHeight ± 1 row
      expect(offsetTop + renderedHeight + offsetBottom).toBeGreaterThanOrEqual(totalHeight - rowStride)
      expect(offsetTop + renderedHeight + offsetBottom).toBeLessThanOrEqual(totalHeight + rowStride)
    })
  })
})
