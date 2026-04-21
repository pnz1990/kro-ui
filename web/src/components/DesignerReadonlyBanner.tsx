// DesignerReadonlyBanner.tsx — Banner shown when Designer is in shared readonly mode.
//
// Displayed when the URL contains a ?share= param, indicating the user is
// viewing a shared RGD state. Provides a link to open it in edit mode.
//
// Design ref: docs/design/31-rgd-designer.md §Future → ✅
// Spec: issue-544

import { useCallback } from 'react'
import './DesignerReadonlyBanner.css'

export interface DesignerReadonlyBannerProps {
  /** Called when the user clicks "Edit a copy" to exit readonly mode. */
  onEdit: () => void
}

/**
 * DesignerReadonlyBanner — informs the user they are viewing a shared
 * read-only RGD Designer snapshot, and offers an "Edit a copy" action.
 */
export default function DesignerReadonlyBanner({ onEdit }: DesignerReadonlyBannerProps) {
  const handleEdit = useCallback(() => {
    // Remove the ?share= param from the URL so the page becomes editable
    const url = new URL(window.location.href)
    url.searchParams.delete('share')
    window.history.replaceState(null, '', url.toString())
    onEdit()
  }, [onEdit])

  return (
    <div
      className="designer-readonly-banner"
      role="status"
      data-testid="designer-readonly-banner"
      aria-label="You are viewing a shared read-only RGD Designer snapshot"
    >
      <span className="designer-readonly-banner__icon" aria-hidden="true">👁</span>
      <span className="designer-readonly-banner__text">
        Read-only shared view — you are previewing a shared RGD Designer snapshot.
      </span>
      <button
        className="designer-readonly-banner__edit-btn"
        onClick={handleEdit}
        aria-label="Exit readonly mode and start editing this RGD"
        data-testid="designer-readonly-edit-btn"
      >
        Edit a copy
      </button>
    </div>
  )
}
