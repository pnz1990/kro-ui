// AuthorPage.tsx — Standalone RGD Designer page at /author.
//
// Renders RGDAuthoringForm on the left, with a live DAG preview and YAML
// preview stacked on the right. DAG updates are debounced at 300ms.
// Purely client-side — no API calls required.
//
// Spec: .specify/specs/039-rgd-authoring-entrypoint/ FR-001, FR-002, FR-003
// Spec: .specify/specs/042-rgd-designer-nav/ (title rename + live DAG)

import { useState, useMemo } from 'react'
import { STARTER_RGD_STATE, generateRGDYAML, rgdAuthoringStateToSpec } from '@/lib/generator'
import type { RGDAuthoringState } from '@/lib/generator'
import { buildDAGGraph } from '@/lib/dag'
import RGDAuthoringForm from '@/components/RGDAuthoringForm'
import StaticChainDAG from '@/components/StaticChainDAG'
import YAMLPreview from '@/components/YAMLPreview'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useDebounce } from '@/hooks/useDebounce'
import './AuthorPage.css'

/**
 * AuthorPage — global RGD Designer entrypoint.
 *
 * Accessible at /author from the top bar "RGD Designer" nav link and
 * from Home / Catalog empty-state links.
 *
 * Layout: form (left) | live DAG preview + YAML preview stacked (right)
 *
 * Spec: 039-rgd-authoring-entrypoint, 042-rgd-designer-nav
 */
export default function AuthorPage() {
  usePageTitle('RGD Designer')

  const [rgdState, setRgdState] = useState<RGDAuthoringState>(STARTER_RGD_STATE)
  const rgdYaml = useMemo(() => generateRGDYAML(rgdState), [rgdState])

  // ── Live DAG preview (debounced 300ms) ──────────────────────────────────
  const debouncedState = useDebounce(rgdState, 300)
  const dagGraph = useMemo(
    () => buildDAGGraph(rgdAuthoringStateToSpec(debouncedState), []),
    [debouncedState],
  )

  return (
    <div className="author-page">
      <div className="author-page__header">
        <h1 className="author-page__title">RGD Designer</h1>
        <p className="author-page__subtitle">
          Scaffold a <code>ResourceGraphDefinition</code> YAML
        </p>
      </div>
      <div className="author-page__body">
        <div className="author-page__form-pane">
          <RGDAuthoringForm state={rgdState} onChange={setRgdState} />
        </div>
        <div className="author-page__right-pane">
          <div className="author-page__dag-pane">
            <StaticChainDAG
              graph={dagGraph}
              rgds={[]}
              rgdName={debouncedState.rgdName || 'my-rgd'}
            />
          </div>
          {debouncedState.resources.length === 0 && (
            <p className="author-page__dag-hint">
              Add resources to see the dependency graph
            </p>
          )}
          <div className="author-page__preview-pane">
            <YAMLPreview yaml={rgdYaml} title="ResourceGraphDefinition" />
          </div>
        </div>
      </div>
    </div>
  )
}
