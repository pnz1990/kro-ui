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

// useTheme — OS-preference light mode with localStorage override.
//
// Behaviour:
//   1. On mount, read localStorage key 'kro-ui-theme':
//        - 'light'  → apply light theme
//        - 'dark'   → apply dark theme
//        - absent   → follow OS preference (prefers-color-scheme media query)
//   2. When OS preference changes (and no localStorage override is set),
//      update the theme automatically.
//   3. setTheme('light' | 'dark') writes to localStorage and applies immediately.
//   4. setTheme(null) removes the localStorage override and reverts to OS preference.
//
// WCAG 2.1 SC 1.4.3: CONTRAST RATIOS
//   tokens.css calibrates contrast ratios per theme mode.
//   Applying the wrong mode can fail contrast requirements for users
//   whose OS is in light mode but our :root defaults to dark.
//
// Design ref: docs/design/27-stage3-kro-tracking.md §Future 27.17

import { useState, useEffect, useCallback } from 'react'

export type ThemePreference = 'light' | 'dark'

const STORAGE_KEY = 'kro-ui-theme'

/**
 * Reads the effective theme: localStorage override or OS preference fallback.
 * Returns 'light' or 'dark'.
 */
function getEffectiveTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall through to OS
  }
  if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

/**
 * Applies the theme by setting data-theme on <html>.
 * 'dark' removes the attribute so tokens.css :root (dark default) takes effect.
 * 'light' sets data-theme="light" to activate the light overrides.
 */
function applyTheme(theme: ThemePreference): void {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

export interface UseThemeResult {
  /** The currently active theme ('light' or 'dark'). */
  theme: ThemePreference
  /**
   * Override the theme.
   * Pass null to remove the localStorage override and revert to OS preference.
   */
  setTheme: (override: ThemePreference | null) => void
  /**
   * Whether there is an active localStorage override.
   * false means the theme follows the OS preference.
   */
  hasOverride: boolean
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const t = getEffectiveTheme()
    // Apply immediately on first render — avoids flash-of-wrong-theme.
    applyTheme(t)
    return t
  })

  const [hasOverride, setHasOverride] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored === 'light' || stored === 'dark'
    } catch {
      return false
    }
  })

  // Listen for OS preference changes when there is no manual override.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)')

    function handleChange(e: MediaQueryListEvent) {
      // Only respond if the user has not set a manual override.
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored === 'light' || stored === 'dark') return
      } catch {
        // localStorage unavailable — always follow OS
      }
      const next: ThemePreference = e.matches ? 'light' : 'dark'
      applyTheme(next)
      setThemeState(next)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const setTheme = useCallback((override: ThemePreference | null) => {
    if (override === null) {
      // Remove override → revert to OS preference
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
      const osTheme = getEffectiveTheme()
      applyTheme(osTheme)
      setThemeState(osTheme)
      setHasOverride(false)
    } else {
      // Apply and persist override
      try {
        localStorage.setItem(STORAGE_KEY, override)
      } catch {
        // localStorage unavailable — still apply in-session
      }
      applyTheme(override)
      setThemeState(override)
      setHasOverride(true)
    }
  }, [])

  return { theme, setTheme, hasOverride }
}
