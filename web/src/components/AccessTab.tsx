import { useEffect, useState } from "react"
import { getRGDAccess } from "@/lib/api"
import type { AccessResponse, GVRPermission } from "@/lib/api"
import PermissionCell from "@/components/PermissionCell"
import RBACFixSuggestion from "@/components/RBACFixSuggestion"
import { translateApiError } from "@/lib/errors"
import "./AccessTab.css"

interface AccessTabProps {
  rgdName: string
}

/** All verbs displayed as columns in the matrix (order matters for display). */
const VERB_COLUMNS = ["get", "list", "watch", "create", "update", "patch", "delete"]

/** True if any required verb is denied for this permission row. */
function hasGap(p: GVRPermission): boolean {
  return p.required.some((v) => !p.granted[v])
}

/** Derive a human-readable resource label for a permission row. */
function resourceLabel(p: GVRPermission): string {
  return p.group ? `${p.group}/${p.resource}` : p.resource
}

/**
 * Return the ClusterRole name to use in fix suggestions.
 * Prefer the backend-resolved name; fall back to a descriptive placeholder
 * so the user knows to replace it (issue #74).
 */
function resolvedClusterRoleName(data: AccessResponse): string {
  if (data.clusterRole) return data.clusterRole
  // Fallback: derive a guess from the SA name, clearly marked as a placeholder
  const saName = data.serviceAccount.split('/')[1] ?? data.serviceAccount
  return `${saName}-manager-role`
}

/**
 * AccessTab — permission matrix for the "Access" tab on the RGD detail page.
 *
 * Fetches GET /api/v1/rgds/{name}/access and renders:
 *  - Service account banner (with SA-not-found fallback → manual override form)
 *  - Success banner (all permissions OK) or warning banner + gap count
 *  - Permission matrix table (GVRs × verbs)
 *  - Collapsible kubectl fix suggestions for each gap row
 *
 * Spec: .specify/specs/018-rbac-visualizer/ + .specify/specs/032-rbac-sa-autodetect/
 */
export default function AccessTab({ rgdName }: AccessTabProps) {
  const [data, setData] = useState<AccessResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Manual SA override form state (US1/US2)
  const [manualNS, setManualNS] = useState("")
  const [manualSAName, setManualSAName] = useState("")
  const [overrideSource, setOverrideSource] = useState<"auto" | "manual" | null>(null)

  useEffect(() => {
    if (!rgdName) return
    setLoading(true)
    setError(null)

    getRGDAccess(rgdName)
      .then((d) => {
        setData(d)
        setError(null)
        setOverrideSource(d.serviceAccountFound ? "auto" : null)
      })
      .catch((err: Error) => {
        setError(err.message)
        setData(null)
      })
      .finally(() => setLoading(false))
  }, [rgdName])

  /** Called when the user submits the manual SA override form. */
  function handleManualSubmit() {
    const ns = manualNS.trim()
    const name = manualSAName.trim()
    if (!ns || !name) return
    setLoading(true)
    setError(null)
    getRGDAccess(rgdName, { saNamespace: ns, saName: name })
      .then((d) => {
        setData(d)
        setError(null)
        setOverrideSource("manual")
      })
      .catch((err: Error) => {
        setError(err.message)
        setData(null)
      })
      .finally(() => setLoading(false))
  }

  if (loading) {
    return <div className="access-tab-loading" data-testid="access-tab-loading">Checking permissions…</div>
  }

  if (error) {
    // 403 on the access tab means kro-ui's own SA can't check permissions — give specific guidance
    const msg = (error.includes('403') || error.toLowerCase().includes('forbidden'))
      ? "kro-ui's own service account lacks permissions to run access checks. Check that the Helm ClusterRole is installed."
      : translateApiError(error)
    return (
      <div className="access-tab-error" role="alert" data-testid="access-tab-error">
        <span className="access-tab-error__msg">{msg}</span>
        <button
          type="button"
          className="access-tab-retry-btn"
          onClick={() => {
            setError(null)
            setLoading(true)
            getRGDAccess(rgdName)
              .then((d) => setData(d))
              .catch((e: Error) => setError(e.message))
              .finally(() => setLoading(false))
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  // ── SA not found: show manual override form ────────────────────────────────
  if (!data.serviceAccountFound && data.serviceAccount === "") {
    const canSubmit = manualNS.trim().length > 0 && manualSAName.trim().length > 0
    return (
      <div className="access-tab" data-testid="access-tab">
        <div className="access-tab-sa-override-form" data-testid="access-tab-sa-override-form">
          <p className="access-tab-sa-override-desc">
            Could not auto-detect kro's service account. Enter it manually to check permissions:
          </p>
          <div className="access-tab-sa-override-inputs">
            <label className="access-tab-sa-override-label">
              Namespace
              <input
                type="text"
                className="access-tab-sa-override-input"
                value={manualNS}
                onChange={(e) => setManualNS(e.target.value)}
                placeholder="e.g. kro-system"
                data-testid="access-tab-sa-ns-input"
              />
            </label>
            <label className="access-tab-sa-override-label">
              Service account name
              <input
                type="text"
                className="access-tab-sa-override-input"
                value={manualSAName}
                onChange={(e) => setManualSAName(e.target.value)}
                placeholder="e.g. kro-controller"
                data-testid="access-tab-sa-name-input"
              />
            </label>
          </div>
          <button
            type="button"
            className="access-tab-sa-override-btn"
            disabled={!canSubmit}
            onClick={handleManualSubmit}
            data-testid="access-tab-sa-override-submit"
          >
            Check permissions
          </button>
        </div>
      </div>
    )
  }

  // ── Normal view: SA known (auto-detected or manually specified) ────────────
  const gapCount = data.permissions.filter(hasGap).length

  // Parse namespace/name from the "namespace/name" serviceAccount string (US3)
  const slashIdx = data.serviceAccount.indexOf("/")
  const saBannerNS = slashIdx >= 0 ? data.serviceAccount.slice(0, slashIdx) : data.serviceAccount
  const saBannerName = slashIdx >= 0 ? data.serviceAccount.slice(slashIdx + 1) : ""

  const sourceLabel =
    overrideSource === "manual"
      ? "(manually specified)"
      : overrideSource === "auto" || data.serviceAccountFound
        ? "(auto-detected)"
        : null

  return (
    <div className="access-tab" data-testid="access-tab">
      {/* Service account info — labeled format (US3) */}
      <div
        className="access-tab-sa-banner"
        data-testid="access-tab-sa-banner"
        title={data.serviceAccount}
      >
        <span className="access-tab-sa-label">Namespace:</span>{" "}
        <code className="access-tab-sa-value" data-testid="access-tab-sa-namespace">
          {saBannerNS}
        </code>
        {saBannerName && (
          <>
            <span className="access-tab-sa-sep" aria-hidden="true">·</span>
            <span className="access-tab-sa-label">Service account:</span>{" "}
            <code className="access-tab-sa-value" data-testid="access-tab-sa-name">
              {saBannerName}
            </code>
          </>
        )}
        {sourceLabel && (
          <span className="access-tab-sa-source">{sourceLabel}</span>
        )}
        {!data.serviceAccountFound && !sourceLabel && (
          <span className="access-tab-sa-note">
            {" "}
            (could not verify service account exists)
          </span>
        )}
      </div>

      <p className="access-tab-note">
        kro-ui checks kro's service account permissions, not its own.
      </p>

      {/* Status banner */}
      {!data.hasGaps ? (
        <div
          className="access-tab-banner access-tab-banner--success"
          data-testid="access-tab-success-banner"
          role="status"
        >
          All permissions satisfied — kro can manage all resources in this RGD.
        </div>
      ) : (
        <div
          className="access-tab-banner access-tab-banner--warning"
          data-testid="access-tab-warning-banner"
          role="alert"
        >
          {gapCount === 1
            ? "1 resource has missing RBAC permissions."
            : `${gapCount} resources have missing RBAC permissions.`}{" "}
          kro cannot manage these resources until the permissions are granted.
        </div>
      )}

      {/* Permission matrix */}
      {data.permissions.length > 0 && (
        <div className="access-tab-table-wrapper">
          <table className="access-tab-table" aria-label="RBAC permission matrix">
            <thead>
              <tr>
                <th className="access-tab-th access-tab-th--resource">Resource</th>
                {VERB_COLUMNS.map((v) => (
                  <th key={v} className="access-tab-th access-tab-th--verb">
                    {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.permissions.map((p) => (
                <tr
                  key={resourceLabel(p)}
                  className={`access-tab-row${hasGap(p) ? " access-tab-row--gap" : ""}`}
                  data-testid="access-tab-row"
                >
                  <td className="access-tab-td access-tab-td--resource">
                    <span className="access-tab-resource-name">
                      {resourceLabel(p)}
                    </span>
                    {p.kind && (
                      <span className="access-tab-resource-kind">{p.kind}</span>
                    )}
                  </td>
                  {VERB_COLUMNS.map((v) =>
                    p.required.includes(v) ? (
                      <PermissionCell
                        key={v}
                        verb={v}
                        granted={p.granted[v] ?? false}
                      />
                    ) : (
                      <td
                        key={v}
                        className="perm-cell perm-cell--na"
                        aria-label={`${v} not applicable`}
                        title="not required"
                      >
                        <span className="perm-cell__icon" aria-hidden="true">
                          —
                        </span>
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fix suggestions for gap rows */}
      {data.hasGaps && (
        <div className="access-tab-fixes" data-testid="access-tab-fixes">
          <h3 className="access-tab-fixes-heading">How to fix</h3>
          {data.permissions
            .filter(hasGap)
            .map((p) => (
              <RBACFixSuggestion
                key={resourceLabel(p)}
                permission={p}
                clusterRoleName={resolvedClusterRoleName(data)}
              />
            ))}
        </div>
      )}
    </div>
  )
}
