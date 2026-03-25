// AuthorPage.tsx — Standalone RGD authoring page at /author.
//
// Renders RGDAuthoringForm + YAMLPreview side-by-side, pre-populated with
// STARTER_RGD_STATE. Purely client-side — no API calls required.
//
// Spec: .specify/specs/039-rgd-authoring-entrypoint/ FR-001, FR-002, FR-003

import { useState, useMemo } from 'react'
import { STARTER_RGD_STATE, generateRGDYAML } from '@/lib/generator'
import type { RGDAuthoringState } from '@/lib/generator'
import RGDAuthoringForm from '@/components/RGDAuthoringForm'
import YAMLPreview from '@/components/YAMLPreview'
import { usePageTitle } from '@/hooks/usePageTitle'
import './AuthorPage.css'

/**
 * AuthorPage — global entrypoint for RGD authoring.
 *
 * Accessible at /author from the top bar "+ New RGD" button and
 * from Home / Catalog empty-state links.
 *
 * Spec: 039-rgd-authoring-entrypoint
 */
export default function AuthorPage() {
  usePageTitle('New RGD')

  const [rgdState, setRgdState] = useState<RGDAuthoringState>(STARTER_RGD_STATE)
  const rgdYaml = useMemo(() => generateRGDYAML(rgdState), [rgdState])

  return (
    <div className="author-page">
      <div className="author-page__header">
        <h1 className="author-page__title">New RGD</h1>
        <p className="author-page__subtitle">
          Scaffold a <code>ResourceGraphDefinition</code> YAML
        </p>
      </div>
      <div className="author-page__body">
        <div className="author-page__form-pane">
          <RGDAuthoringForm state={rgdState} onChange={setRgdState} />
        </div>
        <div className="author-page__preview-pane">
          <YAMLPreview yaml={rgdYaml} title="ResourceGraphDefinition" />
        </div>
      </div>
    </div>
  )
}
