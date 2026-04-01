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
  /** Row gap between cards, in pixels. Must match the CSS grid gap. Default: 16. */
  rowGap?: number
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
  rowGap = 16,
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
    // Row stride = card height + gap between rows.
    // Matches what the CSS grid actually renders: each row occupies itemHeight px
    // of card content plus rowGap px of space before the next row.
    const rowStride = itemHeight + rowGap
    // Total scrollable height: N rows of rowStride, minus one trailing gap.
    const totalHeight = totalRows * rowStride - rowGap

    // Visible row range (0-indexed) — divide scroll position by stride
    const firstVisibleRow = Math.floor(scrollTop / rowStride)
    const visibleRowCount = Math.ceil(containerHeight / rowStride)

    // Apply overscan
    const firstRow = Math.max(0, firstVisibleRow - overscan)
    const lastRow = Math.min(totalRows - 1, firstVisibleRow + visibleRowCount + overscan)

    const firstIndex = firstRow * safeCols
    const lastIndex = Math.min(itemCount, (lastRow + 1) * safeCols)

    // offsetTop is the height of all rows above the rendered window.
    // Each skipped row contributes rowStride (card + gap) to the spacer.
    const offsetTop = firstRow * rowStride
    // offsetBottom is the height of all rows below the rendered window.
    // The last row has no trailing gap, so subtract rowGap once when lastRow
    // is the final row. Using Math.max(0, ...) handles edge cases cleanly.
    const skippedBottomRows = totalRows - lastRow - 1
    const offsetBottom = skippedBottomRows > 0
      ? skippedBottomRows * rowStride
      : 0

    return { firstIndex, lastIndex, offsetTop, offsetBottom, totalHeight }
  }, [itemCount, cols, itemHeight, rowGap, overscan, containerHeight, scrollTop])
}
