// DesignerShareButton.tsx — Copy-to-clipboard share button for the RGD Designer.
//
// Encodes the current RGDAuthoringState into a shareable URL and copies it
// to the clipboard. The recipient visits the URL to see the Design in readonly mode.
//
// Design ref: docs/design/31-rgd-designer.md §Future → ✅ (Designer: collaboration mode)
// Spec: issue-544

import { useState, useCallback } from 'react'
import type { RGDAuthoringState } from '@/lib/generator'
import { buildShareUrl } from '@/lib/share'
import './DesignerShareButton.css'

export interface DesignerShareButtonProps {
  state: RGDAuthoringState
}

type CopyState = 'idle' | 'copied' | 'error'

/**
 * DesignerShareButton — encodes the current Designer state into a URL and
 * copies it to the clipboard when clicked.
 *
 * Shows a brief "Copied!" / "Error" feedback flash for 2s.
 */
export default function DesignerShareButton({ state }: DesignerShareButtonProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const handleShare = useCallback(async () => {
    const url = buildShareUrl(state)
    if (url === null) {
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 2000)
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopyState('copied')
    } catch {
      // Clipboard API may be unavailable (e.g. non-HTTPS, denied permission)
      // Fall back to a textarea select-and-copy approach
      try {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopyState('copied')
      } catch {
        setCopyState('error')
      }
    }

    setTimeout(() => setCopyState('idle'), 2000)
  }, [state])

  const label =
    copyState === 'copied' ? 'Copied!' :
    copyState === 'error'  ? 'Error'   :
    'Share'

  return (
    <button
      className={
        'designer-share-btn' +
        (copyState === 'copied' ? ' designer-share-btn--copied' : '') +
        (copyState === 'error'  ? ' designer-share-btn--error'  : '')
      }
      onClick={handleShare}
      aria-label="Copy shareable Designer URL to clipboard"
      data-testid="designer-share-btn"
      title="Copy a link to share this Designer state (readonly view)"
    >
      {label}
    </button>
  )
}
