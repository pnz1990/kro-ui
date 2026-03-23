// useVirtualGrid — pure row-based windowing arithmetic for a fixed-height card grid.
//
// Given the total item count, number of columns, fixed row height, and current
// scroll state, returns the slice of items that should be rendered plus the
// spacer heights needed to maintain the full scrollable height.
//
// This hook is side-effect-free: same inputs → same outputs always.

import { useMemo } from 'react'

export interface UseVirtualGridOptions {
  itemCount: number
  cols: number
  itemHeight: number
  overscan?: number
  containerHeight: number
  scrollTop: number
}

export interface UseVirtualGridResult {
  firstIndex: number
  lastIndex: number
  offsetTop: number
  offsetBottom: number
  totalHeight: number
}

export function useVirtualGrid({
  itemCount,
  cols,
  itemHeight,
  overscan = 2,
  containerHeight,
  scrollTop,
}: UseVirtualGridOptions): UseVirtualGridResult {
  return useMemo(() => {
    const safeCols = Math.max(1, cols)

    if (itemCount === 0) {
      return { firstIndex: 0, lastIndex: 0, offsetTop: 0, offsetBottom: 0, totalHeight: 0 }
    }

    const totalRows = Math.ceil(itemCount / safeCols)
    const totalHeight = totalRows * itemHeight

    // Visible row range (0-indexed)
    const firstVisibleRow = Math.floor(scrollTop / itemHeight)
    const visibleRowCount = Math.ceil(containerHeight / itemHeight)

    // Apply overscan
    const firstRow = Math.max(0, firstVisibleRow - overscan)
    const lastRow = Math.min(totalRows - 1, firstVisibleRow + visibleRowCount + overscan)

    const firstIndex = firstRow * safeCols
    const lastIndex = Math.min(itemCount, (lastRow + 1) * safeCols)

    const offsetTop = firstRow * itemHeight
    const offsetBottom = Math.max(0, (totalRows - lastRow - 1) * itemHeight)

    return { firstIndex, lastIndex, offsetTop, offsetBottom, totalHeight }
  }, [itemCount, cols, itemHeight, overscan, containerHeight, scrollTop])
}
