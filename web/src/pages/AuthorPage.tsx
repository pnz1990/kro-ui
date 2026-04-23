// AuthorPage.tsx — Standalone RGD Designer page at /author.
//
// Layout: header + tab bar + tab content.
// Tabs: Schema (metadata/fields) | Resources | YAML | Preview (DAG).
//
// Tab state and selected node ID are persisted to sessionStorage (key:
// kro-ui-designer-tab-state) so navigating away and returning restores
// the last working context.
//
// Spec: .specify/specs/039-rgd-authoring-entrypoint/ FR-001, FR-002, FR-003
// Spec: .specify/specs/042-rgd-designer-nav/ (title rename + live DAG)
// Spec: .specify/specs/issue-542/ (cluster import panel)
// Spec: issue-543 (node library)
// Spec: issue-544 (collaboration mode — share URL)
// Spec: issue-647 (localStorage draft persistence)
// Spec: issue-684 (tab focus restoration — sessionStorage)

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { STARTER_RGD_STATE, generateRGDYAML, rgdAuthoringStateToSpec } from '@/lib/generator'
import type { RGDAuthoringState, AuthoringResource } from '@/lib/generator'
import { buildDAGGraph } from '@/lib/dag'
import type { DAGGraph } from '@/lib/dag'
import type { StaticIssue, ApplyRGDResult } from '@/lib/api'
import * as api from '@/lib/api'
import { extractShareFromUrl } from '@/lib/share'
import { useCapabilities } from '@/lib/features'
import RGDAuthoringForm from '@/components/RGDAuthoringForm'
import StaticChainDAG from '@/components/StaticChainDAG'
import YAMLPreview from '@/components/YAMLPreview'
import YAMLImportPanel from '@/components/YAMLImportPanel'
import ClusterImportPanel from '@/components/ClusterImportPanel'
import NodeLibrary from '@/components/NodeLibrary'
import DesignerShareButton from '@/components/DesignerShareButton'
import DesignerReadonlyBanner from '@/components/DesignerReadonlyBanner'
import DesignerTabBar from '@/components/DesignerTabBar'
import DesignerTour, { TOUR_KEY } from '@/components/DesignerTour'
import type { DesignerTab } from '@/components/DesignerTabBar'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useDebounce } from '@/hooks/useDebounce'
import './AuthorPage.css'

/** Sentinel empty graph returned when buildDAGGraph throws (issue #247). */
const EMPTY_GRAPH: DAGGraph = { nodes: [], edges: [], width: 0, height: 0 }

/** localStorage key for the in-progress RGD draft. Spec: issue-647 O1. */
const DRAFT_KEY = 'kro-ui-designer-draft'

/** sessionStorage key for Designer tab state. Spec: issue-684 O5. */
const TAB_STATE_KEY = 'kro-ui-designer-tab-state'

/** Shape of the persisted tab state. Spec: issue-684 O5. */
interface DesignerTabState {
  activeTab: DesignerTab
  selectedNodeId: string | null
}

const VALID_TABS: DesignerTab[] = ['schema', 'resources', 'yaml', 'preview']

/**
 * Read persisted tab state from sessionStorage. Returns null on absence or
 * corruption so callers can fall back to defaults. Spec: issue-684 O5, O7.
 */
function readTabState(): DesignerTabState | null {
  try {
    const raw = sessionStorage.getItem(TAB_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('activeTab' in parsed) ||
      !VALID_TABS.includes((parsed as DesignerTabState).activeTab)
    ) {
      return null
    }
    const { activeTab, selectedNodeId } = parsed as DesignerTabState
    return {
      activeTab,
      selectedNodeId: typeof selectedNodeId === 'string' ? selectedNodeId : null,
    }
  } catch {
    return null
  }
}

/**
 * Write tab state to sessionStorage. Spec: issue-684 O5, O6.
 * No-op when readonly (share URL) mode — ephemeral state should not persist.
 */
function writeTabState(state: DesignerTabState, readonly: boolean): void {
  if (readonly) return
  try {
    sessionStorage.setItem(TAB_STATE_KEY, JSON.stringify(state))
  } catch {
    // Private browsing or quota exceeded — ignore silently
  }
}

/**
 * Read a saved draft from localStorage. Returns null if absent or corrupt.
 * Spec: issue-647 O2, O4
 */
function readDraft(): RGDAuthoringState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as RGDAuthoringState
  } catch {
    return null
  }
}

/**
 * Determine the initial state: prefer URL share param, fall back to STARTER_RGD_STATE.
 * Called once at mount — safe to call without SSR because window.location is available.
 */
function resolveInitialState(): { state: RGDAuthoringState; readonly: boolean } {
  const shared = extractShareFromUrl()
  if (shared !== null) {
    return { state: shared, readonly: true }
  }
  return { state: STARTER_RGD_STATE, readonly: false }
}

/**
 * AuthorPage — global RGD Designer entrypoint.
 *
 * Accessible at /author from the top bar "RGD Designer" nav link and
 * from Home / Catalog empty-state links.
 *
 * Layout: header | tab bar | tab content
 * Tabs: Schema (metadata + fields) | Resources | YAML | Preview (DAG)
 *
 * When a ?share= param is present, the page loads in readonly mode with
 * the encoded RGD state and shows a banner inviting the user to edit a copy.
 *
 * Spec: 039-rgd-authoring-entrypoint, 042-rgd-designer-nav, issue-544, issue-684
 */
export default function AuthorPage() {
  usePageTitle('RGD Designer')

  const initial = useMemo(() => resolveInitialState(), [])
  const [rgdState, setRgdState] = useState<RGDAuthoringState>(initial.state)
  const [readonly, setReadonly] = useState<boolean>(initial.readonly)
  const rgdYaml = useMemo(() => generateRGDYAML(rgdState), [rgdState])

  // ── Capabilities — used to gate canApplyRGDs (spec issue-713) ───────────
  const { capabilities } = useCapabilities()

  // ── Tab state with sessionStorage restoration (issue-684) ────────────────
  const [activeTab, setActiveTab] = useState<DesignerTab>(() => {
    if (initial.readonly) return 'schema' // share URL: always start at schema (O6)
    return readTabState()?.activeTab ?? 'schema'
  })

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => {
    if (initial.readonly) return null
    return readTabState()?.selectedNodeId ?? null
  })

  // Persist tab state on change (O5). Skip in readonly mode (O6).
  useEffect(() => {
    writeTabState({ activeTab, selectedNodeId }, readonly)
  }, [activeTab, selectedNodeId, readonly])

  function handleTabChange(tab: DesignerTab) {
    setActiveTab(tab)
  }

  // ── localStorage draft persistence (issue-647) ──────────────────────────
  // On mount: if not in readonly (shared URL) mode and a draft exists, offer restore.
  const [pendingDraft, setPendingDraft] = useState<RGDAuthoringState | null>(() =>
    initial.readonly ? null : readDraft()
  )

  // Auto-save: debounced 2s after each change in non-readonly mode (spec O1, O8).
  const debouncedForSave = useDebounce(rgdState, 2000)
  useEffect(() => {
    if (readonly) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(debouncedForSave))
    } catch {
      // Quota exceeded or private browsing — ignore silently
    }
  }, [debouncedForSave, readonly])

  // Restore: load the saved draft and clear the prompt (spec O3, O4).
  const handleRestoreDraft = useCallback(() => {
    if (pendingDraft) {
      setRgdState(pendingDraft)
    }
    setPendingDraft(null)
  }, [pendingDraft])

  // Discard: clear localStorage and dismiss the prompt (spec O3, O5).
  const handleDiscardDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch { /* ignore */ }
    setPendingDraft(null)
  }, [])

  // ── Guided tour (spec issue-766) ─────────────────────────────────────────
  // Show on first visit (toured key absent) unless in readonly mode (O1, O8).
  const [tourVisible, setTourVisible] = useState<boolean>(() => {
    if (initial.readonly) return false
    try {
      return localStorage.getItem(TOUR_KEY) !== 'true'
    } catch {
      return false
    }
  })
  const [tourStep, setTourStep] = useState(0)

  // Dismiss: mark toured and hide (O3, O4).
  const handleTourDismiss = useCallback(() => {
    try {
      localStorage.setItem(TOUR_KEY, 'true')
    } catch { /* ignore */ }
    setTourVisible(false)
    setTourStep(0)
  }, [])

  // Re-trigger: remove toured key and show tour again (O5).
  const handleTourRetrigger = useCallback(() => {
    try {
      localStorage.removeItem(TOUR_KEY)
    } catch { /* ignore */ }
    setTourStep(0)
    setTourVisible(true)
  }, [])

  // "?" button ref for keeping focus when tour closes (a11y best practice).
  const tourTriggerRef = useRef<HTMLButtonElement>(null)

  // ── Node library — append resource from template ─────────────────────────
  const handleAddResource = useCallback((resource: AuthoringResource) => {
    setRgdState((prev) => ({ ...prev, resources: [...prev.resources, resource] }))
  }, [])

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

  // ── Apply to cluster (spec issue-713) — manual, triggered by button ─────
  // Only rendered when canApplyRGDs capability is true (O3, O4).
  const [applyResult, setApplyResult] = useState<ApplyRGDResult | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applyLoading, setApplyLoading] = useState(false)

  // Clear stale apply result whenever YAML changes
  useEffect(() => {
    setApplyResult(null)
    setApplyError(null)
  }, [rgdYaml])

  const canApplyRGDs = capabilities?.featureGates?.['canApplyRGDs'] === true

  async function handleApply() {
    setApplyLoading(true)
    setApplyResult(null)
    setApplyError(null)
    try {
      const res = await api.applyRGD(rgdYaml)
      setApplyResult(res)
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Apply failed')
    } finally {
      setApplyLoading(false)
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

  // ── Common banners (shown above tab bar) ────────────────────────────────
  const banners = (
    <>
      {pendingDraft !== null && (
        <div
          className="author-page__draft-banner"
          role="status"
          data-testid="draft-restore-banner"
        >
          <span className="author-page__draft-banner-text">
            You have an unsaved draft from a previous session.
          </span>
          <div className="author-page__draft-banner-actions">
            <button
              className="author-page__draft-btn author-page__draft-btn--restore"
              onClick={handleRestoreDraft}
              data-testid="draft-restore-btn"
            >
              Restore draft
            </button>
            <button
              className="author-page__draft-btn author-page__draft-btn--discard"
              onClick={handleDiscardDraft}
              data-testid="draft-discard-btn"
            >
              Discard
            </button>
          </div>
        </div>
      )}
      {readonly && (
        <DesignerReadonlyBanner onEdit={() => setReadonly(false)} />
      )}
    </>
  )

  return (
    <>
    <div className="author-page">
      <div className="author-page__header">
        <div className="author-page__header-row">
          <h1 className="author-page__title">RGD Designer</h1>
          <div className="author-page__header-actions">
            {!readonly && (
              <button
                ref={tourTriggerRef}
                className="author-page__tour-trigger-btn"
                onClick={handleTourRetrigger}
                aria-label="Open Designer guided tour"
                data-testid="tour-trigger-btn"
                title="Open guided tour"
              >
                ?
              </button>
            )}
            <DesignerShareButton state={rgdState} />
          </div>
        </div>
        <p className="author-page__subtitle">
          Scaffold a <code>ResourceGraphDefinition</code> YAML
        </p>
      </div>

      {banners}

      <NodeLibrary onAddResource={handleAddResource} />
      <ClusterImportPanel onImport={setRgdState} />
      <YAMLImportPanel onImport={setRgdState} />

      {/* Tab bar — Schema | Resources | YAML | Preview */}
      <DesignerTabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab content */}
      <div className="author-page__tab-content" role="tabpanel" data-testid="designer-tab-content">
        {activeTab === 'schema' && (
          <div className="author-page__tab-pane">
            <RGDAuthoringForm
              state={rgdState}
              onChange={readonly ? undefined : setRgdState}
              staticIssues={staticIssues}
              readonly={readonly}
              visibleSections="schema"
            />
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="author-page__tab-pane">
            <RGDAuthoringForm
              state={rgdState}
              onChange={readonly ? undefined : setRgdState}
              staticIssues={staticIssues}
              readonly={readonly}
              visibleSections="resources"
            />
          </div>
        )}

        {activeTab === 'yaml' && (
          <div className="author-page__tab-pane">
            <YAMLPreview
              yaml={rgdYaml}
              title="ResourceGraphDefinition"
              onValidate={handleValidate}
              validateResult={dryRunResult}
              validateLoading={dryRunLoading}
              onApply={canApplyRGDs && !readonly ? handleApply : undefined}
              applyResult={applyResult}
              applyError={applyError}
              applyLoading={applyLoading}
            />
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="author-page__tab-pane author-page__tab-pane--dag">
            <div className="author-page__dag-pane">
              <StaticChainDAG
                graph={dagGraph}
                rgds={[]}
                rgdName={debouncedState.rgdName || 'my-rgd'}
                selectedNodeId={selectedNodeId ?? undefined}
                onNodeClick={(id) => setSelectedNodeId(id)}
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
          </div>
        )}
      </div>
    </div>

    {/* Guided tour overlay (spec issue-766) — portal, shown on first visit */}
    {tourVisible && !readonly && (
      <DesignerTour
        step={tourStep}
        onNext={() => setTourStep((s) => s + 1)}
        onBack={() => setTourStep((s) => Math.max(0, s - 1))}
        onDismiss={handleTourDismiss}
      />
    )}
    </>
  )
}
