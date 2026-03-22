// usePageTitle — sets document.title on mount/update.
// Format: "<title> — kro-ui" (or just "kro-ui" for the home page).
// Implements constitution §XIII, issue #67.

import { useEffect } from 'react'

const SUFFIX = ' — kro-ui'

/**
 * Sets document.title to `${title} — kro-ui`.
 * Pass an empty string (or omit) to set just "kro-ui" (home page).
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title ? title + SUFFIX : 'kro-ui'
    return () => {
      // Reset to bare "kro-ui" on unmount so navigating back doesn't
      // keep stale titles while the next page mounts.
      document.title = 'kro-ui'
    }
  }, [title])
}
