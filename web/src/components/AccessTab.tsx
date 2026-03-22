import { useEffect, useState } from "react"
import { getRGDAccess } from "@/lib/api"
import type { AccessResponse, GVRPermission } from "@/lib/api"
import PermissionCell from "@/components/PermissionCell"
import RBACFixSuggestion from "@/components/RBACFixSuggestion"
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
 * Infer a best-guess ClusterRole name from the service account display string.
 * e.g. "kro-system/kro" → "kro-manager-role"
 * The generated command includes a disclaimer to replace if different.
 */
function inferClusterRoleName(serviceAccount: string): string {
  const saName = serviceAccount.split("/")[1] ?? serviceAccount
  return `${saName}-manager-role`
}

/**
 * AccessTab — permission matrix for the "Access" tab on the RGD detail page.
 *
 * Fetches GET /api/v1/rgds/{name}/access and renders:
 *  - Service account banner (with SA-not-found fallback)
 *  - Success banner (all permissions OK) or warning banner + gap count
 *  - Permission matrix table (GVRs × verbs)
 *  - Collapsible kubectl fix suggestions for each gap row
 *
 * Spec: .specify/specs/018-rbac-visualizer/
 */
export default function AccessTab({ rgdName }: AccessTabProps) {
  const [data, setData] = useState<AccessResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!rgdName) return
    setLoading(true)
    setError(null)

    getRGDAccess(rgdName)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((err: Error) => {
        setError(err.message)
        setData(null)
      })
      .finally(() => setLoading(false))
  }, [rgdName])

  if (loading) {
    return <div className="access-tab-loading">Checking permissions…</div>
  }

  if (error) {
    return (
      <div className="access-tab-error" data-testid="access-tab-error">
        <span className="access-tab-error__msg">Error: {error}</span>
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

  const gapCount = data.permissions.filter(hasGap).length

  return (
    <div className="access-tab" data-testid="access-tab">
      {/* Service account info */}
      <div className="access-tab-sa-banner" data-testid="access-tab-sa-banner">
        <span className="access-tab-sa-label">Checking kro service account:</span>{" "}
        <code className="access-tab-sa-name">{data.serviceAccount}</code>
        {!data.serviceAccountFound && (
          <span className="access-tab-sa-note">
            {" "}
            (detected automatically — could not verify service account exists)
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
                clusterRoleName={inferClusterRoleName(data.serviceAccount)}
              />
            ))}
        </div>
      )}
    </div>
  )
}
