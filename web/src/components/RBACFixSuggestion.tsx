import { useState } from "react"
import type { GVRPermission } from "@/lib/api"
import KroCodeBlock from "@/components/KroCodeBlock"
import "./RBACFixSuggestion.css"

interface RBACFixSuggestionProps {
  permission: GVRPermission
  /** The name of kro's ClusterRole (best-guess derived from the service account name). */
  clusterRoleName: string
}

/** Build the ClusterRole rule YAML for the missing permissions. */
function buildRuleYAML(p: GVRPermission): string {
  const missingVerbs = p.required.filter((v) => !p.granted[v])
  if (missingVerbs.length === 0) return ""

  const apiGroup = p.group === "" ? '""' : `"${p.group}"`
  return [
    "# Add this rule to kro's ClusterRole:",
    "- apiGroups:",
    `  - ${apiGroup}`,
    "  resources:",
    `  - ${p.resource}`,
    "  verbs:",
    ...missingVerbs.map((v) => `  - ${v}`),
  ].join("\n")
}

/** Build the kubectl patch command to add the rule. */
function buildKubectlCommand(p: GVRPermission, clusterRoleName: string): string {
  const missingVerbs = p.required.filter((v) => !p.granted[v])
  if (missingVerbs.length === 0) return ""

  const apiGroup = p.group === "" ? "" : p.group
  const verbList = missingVerbs.join(",")
  return `kubectl patch clusterrole ${clusterRoleName} \\
  --type=json \\
  -p='[{"op":"add","path":"/rules/-","value":{"apiGroups":["${apiGroup}"],"resources":["${p.resource}"],"verbs":["${verbList.replace(/,/g, '","')}"]}}]'`
}

/**
 * RBACFixSuggestion — collapsible block showing the kubectl fix for a permission gap.
 *
 * Spec: .specify/specs/018-rbac-visualizer/ US2
 */
export default function RBACFixSuggestion({
  permission,
  clusterRoleName,
}: RBACFixSuggestionProps) {
  const [open, setOpen] = useState(false)

  const missingVerbs = permission.required.filter(
    (v) => !permission.granted[v],
  )
  if (missingVerbs.length === 0) return null

  const ruleYAML = buildRuleYAML(permission)
  const kubectlCmd = buildKubectlCommand(permission, clusterRoleName)

  const resourceLabel =
    permission.group ? `${permission.group}/${permission.resource}` : permission.resource

  return (
    <div className="rbac-fix" data-testid="rbac-fix-suggestion">
      <button
        type="button"
        className="rbac-fix__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="rbac-fix__chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        <span className="rbac-fix__label">
          Fix: grant{" "}
          <code className="rbac-fix__resource">{resourceLabel}</code>{" "}
          permissions ({missingVerbs.join(", ")})
        </span>
      </button>

      {open && (
        <div className="rbac-fix__body">
          <p className="rbac-fix__note">
            Add this rule to kro&apos;s ClusterRole, then apply with the command
            below. Replace{" "}
            <code className="rbac-fix__resource">{clusterRoleName}</code> with
            your actual kro ClusterRole name if different.
          </p>
          <KroCodeBlock code={ruleYAML} title="ClusterRole rule (YAML)" />
          <KroCodeBlock code={kubectlCmd} title="kubectl patch command" />
        </div>
      )}
    </div>
  )
}
