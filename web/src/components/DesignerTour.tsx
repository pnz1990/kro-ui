// DesignerTour.tsx — 4-step guided onboarding tour for the RGD Designer.
//
// Shown on first visit to /author (when localStorage key `kro-ui-designer-toured`
// is absent). Can be dismissed at any step or re-triggered via the "?" button
// in the AuthorPage header.
//
// Design ref: docs/design/31-rgd-designer.md §Future 31.1 → ✅
// Spec: .specify/specs/issue-766/spec.md

import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './DesignerTour.css'

/** localStorage key for tour completion. Spec: O1, O3, O4. */
export const TOUR_KEY = 'kro-ui-designer-toured'

/** The 4 tour steps. Spec: O2. */
const TOUR_STEPS: Array<{ title: string; description: string }> = [
  {
    title: 'Schema field editor',
    description:
      'Define your Custom Resource kind and schema fields here. ' +
      'The Schema tab lets you name your RGD, set the Kind, and add typed fields ' +
      'that users fill in when creating instances.',
  },
  {
    title: 'Resource node types',
    description:
      'The Resources tab lets you add managed resources — Deployments, Services, ' +
      'ConfigMaps, and more. Each node supports CEL expressions for dynamic values, ' +
      'includeWhen conditionals, and readyWhen health checks.',
  },
  {
    title: 'YAML preview & live DAG',
    description:
      'The YAML tab shows a live preview of your ResourceGraphDefinition manifest. ' +
      'The Preview tab renders a dependency graph so you can see how resources relate ' +
      'before applying to the cluster.',
  },
  {
    title: 'Apply to cluster',
    description:
      'Once your RGD looks correct, use "Validate" to run a dry-run check, then ' +
      '"Apply to cluster" to create or update the ResourceGraphDefinition on your ' +
      'connected kro cluster. The Apply button is visible when the cluster capability ' +
      'is enabled.',
  },
]

export interface DesignerTourProps {
  /** Current step index (0-based). */
  step: number
  /** Called when the user advances to the next step or finishes the tour. */
  onNext: () => void
  /** Called when the user goes back a step. */
  onBack: () => void
  /** Called when the user dismisses the tour (Skip or Finish). */
  onDismiss: () => void
}

/**
 * DesignerTour — overlay guided tour for first-time Designer users.
 * Rendered via createPortal to document.body so it sits above all page content.
 *
 * Spec: issue-766 O1–O8
 */
export default function DesignerTour({
  step,
  onNext,
  onBack,
  onDismiss,
}: DesignerTourProps) {
  const totalSteps = TOUR_STEPS.length
  const current = TOUR_STEPS[step]
  const isFirst = step === 0
  const isLast = step === totalSteps - 1

  // Trap focus inside the dialog on mount and step change
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    dialogRef.current?.focus()
  }, [step])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onDismiss()
      }
    },
    [onDismiss],
  )

  return createPortal(
    <div
      className="designer-tour__backdrop"
      data-testid="designer-tour-overlay"
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        className="designer-tour__card"
        role="dialog"
        aria-modal="true"
        aria-label="Designer guided tour"
        aria-describedby="designer-tour-description"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        data-testid="designer-tour-card"
      >
        <div className="designer-tour__header">
          <span className="designer-tour__step-count" aria-live="polite">
            {step + 1} of {totalSteps}
          </span>
          <button
            className="designer-tour__skip-btn"
            onClick={onDismiss}
            aria-label="Skip tour"
            data-testid="tour-skip-btn"
          >
            Skip tour
          </button>
        </div>

        <h2 className="designer-tour__title">{current.title}</h2>
        <p
          className="designer-tour__description"
          id="designer-tour-description"
        >
          {current.description}
        </p>

        <div className="designer-tour__footer">
          <div className="designer-tour__dots" aria-hidden="true">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={`designer-tour__dot${i === step ? ' designer-tour__dot--active' : ''}`}
              />
            ))}
          </div>
          <div className="designer-tour__nav">
            {!isFirst && (
              <button
                className="designer-tour__nav-btn designer-tour__nav-btn--back"
                onClick={onBack}
                aria-label="Go to previous tour step"
                data-testid="tour-back-btn"
              >
                Back
              </button>
            )}
            <button
              className="designer-tour__nav-btn designer-tour__nav-btn--next"
              onClick={isLast ? onDismiss : onNext}
              aria-label={isLast ? 'Finish tour' : 'Go to next tour step'}
              data-testid={isLast ? 'tour-finish-btn' : 'tour-next-btn'}
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
