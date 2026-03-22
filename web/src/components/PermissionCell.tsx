import "./PermissionCell.css"

interface PermissionCellProps {
  /** Whether this permission is granted */
  granted: boolean
  /** The verb being represented (e.g. "get", "create") */
  verb: string
}

/**
 * PermissionCell renders a single verb permission as a green ✓ or red ✗.
 *
 * Color is paired with a text symbol to satisfy WCAG AA (§IX — never color alone).
 * Spec: .specify/specs/018-rbac-visualizer/
 */
export default function PermissionCell({ granted, verb }: PermissionCellProps) {
  return (
    <td
      className={`perm-cell perm-cell--${granted ? "granted" : "denied"}`}
      title={granted ? `${verb}: granted` : `${verb}: not granted`}
      aria-label={`${verb} ${granted ? "granted" : "denied"}`}
    >
      <span className="perm-cell__icon" aria-hidden="true">
        {granted ? "✓" : "✗"}
      </span>
    </td>
  )
}
