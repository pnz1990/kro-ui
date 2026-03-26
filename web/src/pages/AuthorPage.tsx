// AuthorPage.tsx — Standalone RGD Designer page at /author.
//
// Renders RGDAuthoringForm on the left, with a live DAG preview and YAML
// preview stacked on the right. DAG updates are debounced at 300ms.
// Purely client-side — no API calls required.
//
// Spec: .specify/specs/039-rgd-authoring-entrypoint/ FR-001, FR-002, FR-003
// Spec: .specify/specs/042-rgd-designer-nav/ (title rename + live DAG)

import { useState, useMemo, useEffect } from 'react'
import { STARTER_RGD_STATE, generateRGDYAML, rgdAuthoringStateToSpec } from '@/lib/generator'
import type { RGDAuthoringState } from '@/lib/generator'
import { buildDAGGraph } from '@/lib/dag'
import type { DAGGraph } from '@/lib/dag'
import type { StaticIssue } from '@/lib/api'
import * as api from '@/lib/api'
import RGDAuthoringForm from '@/components/RGDAuthoringForm'
import StaticChainDAG from '@/components/StaticChainDAG'
import YAMLPreview from '@/components/YAMLPreview'
import YAMLImportPanel from '@/components/YAMLImportPanel'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useDebounce } from '@/hooks/useDebounce'
import './AuthorPage.css'

/** Sentinel empty graph returned when buildDAGGraph throws (issue #247). */
const EMPTY_GRAPH: DAGGraph = { nodes: [], edges: [], width: 0, height: 0 }

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

  // ── Offline static validation (US10) — debounced 1s after YAML changes ──
  const [staticIssues, setStaticIssues] = useState<StaticIssue[]>([])
  useEffect(() => {
    const t = setTimeout(() => {
      api.validateRGDStatic(rgdYaml).then((result) => setStaticIssues(result.issues))
    }, 1000)
    return () => clearTimeout(t)
  }, [rgdYaml])

  // ── Dry-run cluster validation (US9) — manual, triggered by button ───────
  const [dryRunResult, setDryRunResult] = useState<api.DryRunResult | null>(null)
  const [dryRunLoading, setDryRunLoading] = useState(false)

  // Clear stale result whenever YAML changes
  useEffect(() => { setDryRunResult(null) }, [rgdYaml])

  async function handleValidate() {
    setDryRunLoading(true)
    setDryRunResult(null)
    try {
      const res = await api.validateRGD(rgdYaml)
      setDryRunResult(res)
    } catch {
      setDryRunResult({ valid: false, error: 'Could not reach cluster' })
    } finally {
      setDryRunLoading(false)
    }
  }

  // ── Live DAG preview (debounced 300ms) ──────────────────────────────────
  const debouncedState = useDebounce(rgdState, 300)

  // Issue #247: wrap in try-catch so an invalid/circular form state can't
  // propagate an unhandled exception out of useMemo and crash the page.
  // On error return an empty graph and surface a notice below the DAG.
  const [dagError, setDagError] = useState<string | null>(null)
  const dagGraph = useMemo(() => {
    try {
      setDagError(null)
      return buildDAGGraph(rgdAuthoringStateToSpec(debouncedState), [])
    } catch (err) {
      setDagError(err instanceof Error ? err.message : 'Invalid form state')
      return EMPTY_GRAPH
    }
  }, [debouncedState])

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
          <YAMLImportPanel onImport={setRgdState} />
          <RGDAuthoringForm state={rgdState} onChange={setRgdState} staticIssues={staticIssues} />
        </div>
        <div className="author-page__right-pane">
          <div className="author-page__dag-pane">
            <StaticChainDAG
              graph={dagGraph}
              rgds={[]}
              rgdName={debouncedState.rgdName || 'my-rgd'}
            />
          </div>
          {dagError !== null && (
            <p
              className="author-page__dag-hint author-page__dag-hint--error"
              data-testid="author-dag-error"
              role="alert"
            >
              DAG preview unavailable: {dagError}
            </p>
          )}
          {dagError === null && debouncedState.resources.length === 0 && (
            <p className="author-page__dag-hint">
              Add resources to see the dependency graph
            </p>
          )}
          <div className="author-page__preview-pane">
            <YAMLPreview
              yaml={rgdYaml}
              title="ResourceGraphDefinition"
              onValidate={handleValidate}
              validateResult={dryRunResult}
              validateLoading={dryRunLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
