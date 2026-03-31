// VirtualGrid — generic windowed grid component.
//
// Renders only the cards currently visible in the viewport plus an overscan
// buffer. Uses a ResizeObserver to track container width (for column count)
// and an onScroll handler to track scroll position.
//
// Contract: items must be pre-filtered and pre-sorted by the caller.
//           itemHeight must be fixed and uniform across all items.

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualGrid } from '@/hooks/useVirtualGrid'
import './VirtualGrid.css'

export interface VirtualGridProps<T> {
  /** Fully filtered, sorted list of items to render. */
  items: T[]
  /** Called only for items in the visible window. */
  renderItem: (item: T, index: number) => ReactNode
  /** Fixed height of each card in pixels. ALL items must share this height. */
  itemHeight: number
  /** Additional CSS class on the outermost container div. */
  className?: string
  /** Shown when items.length === 0. Defaults to a generic message. */
  emptyState?: ReactNode
}

const MIN_CARD_WIDTH = 320

export default function VirtualGrid<T>({
  items,
  renderItem,
  itemHeight,
  className,
  emptyState,
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)

  // Track the previous item count so we can reset scroll when items shrink
  const prevItemCount = useRef(items.length)

  // ResizeObserver — updates containerWidth and containerHeight on resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Math.floor prevents sub-pixel rounding from producing a grid
        // fractionally wider than the container, which would cause a spurious
        // horizontal scrollbar. contentRect.width is a float (e.g. 1274.666);
        // flooring it ensures col calculations always fit within the container.
        const { width, height } = entry.contentRect
        setContainerWidth(Math.floor(width))
        setContainerHeight(Math.floor(height))
      }
    })

    observer.observe(el)
    // Set initial dimensions synchronously — floor to prevent sub-pixel scrollbar
    setContainerWidth(Math.floor(el.clientWidth))
    setContainerHeight(Math.floor(el.clientHeight))

    return () => {
      observer.disconnect()
    }
  }, [])

  // Reset scroll to top when the item list shrinks (e.g. after a filter change)
  useEffect(() => {
    if (items.length < prevItemCount.current && containerRef.current) {
      containerRef.current.scrollTop = 0
      setScrollTop(0)
    }
    prevItemCount.current = items.length
  }, [items.length])

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])

  // Column count: account for gaps so the grid never overflows the container.
  // With N columns and (N-1) gaps of GRID_GAP px:
  //   N * MIN_CARD_WIDTH + (N-1) * GRID_GAP <= containerWidth
  //   N <= (containerWidth + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP)
  const GRID_GAP = 16
  const cols = Math.max(1, Math.floor((containerWidth + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP)))

  // When containerHeight is 0 (not yet measured — JSDOM, SSR, or first paint),
  // render all items so the page is not blank and tests work without mocking
  // ResizeObserver. The real windowing kicks in on the first ResizeObserver callback.
  const unmeasured = containerHeight === 0
  const { firstIndex, lastIndex, offsetTop, offsetBottom } = useVirtualGrid({
    itemCount: items.length,
    cols,
    itemHeight,
    containerHeight: unmeasured ? 99999 : containerHeight,
    scrollTop,
  })

  const visibleItems = unmeasured ? items : items.slice(firstIndex, lastIndex)

  if (items.length === 0) {
    return (
      <div
        ref={containerRef}
        className={['virtual-grid', className].filter(Boolean).join(' ')}
        data-testid="virtual-grid-container"
      >
        <div className="virtual-grid__empty" role="status">
          {emptyState ?? <p>No items to display.</p>}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={['virtual-grid', className].filter(Boolean).join(' ')}
      onScroll={handleScroll}
      data-testid="virtual-grid-container"
      role="list"
      aria-label="Resource graph definitions"
    >
      {!unmeasured && offsetTop > 0 && (
        <div
          className="virtual-grid__spacer"
          style={{ height: offsetTop }}
          aria-hidden="true"
        />
      )}

      <div
        className="virtual-grid__items"
        style={{ ['--vg-cols' as string]: cols }}
        data-testid="virtual-grid-items"
      >
        {visibleItems.map((item, i) => (
          <div key={firstIndex + i} role="listitem">
            {renderItem(item, firstIndex + i)}
          </div>
        ))}
      </div>

      {!unmeasured && offsetBottom > 0 && (
        <div
          className="virtual-grid__spacer"
          style={{ height: offsetBottom }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
