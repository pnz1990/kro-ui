// useDebounce — delays emitting a value until the user has stopped changing it
// for at least `delayMs` milliseconds.
//
// Usage:
//   const debouncedQuery = useDebounce(searchQuery, 300)
//
// The returned value updates only after `delayMs` ms of inactivity.
// On first render the initial value is returned synchronously.
// The pending timer is cancelled on unmount (no stale setState).

import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delayMs])

  return debouncedValue
}
