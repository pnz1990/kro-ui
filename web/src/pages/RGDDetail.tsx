// RGDDetail — DAG view, instances tab, raw YAML with CEL highlighting.
// TODO: implement

import { useCapabilities, isExperimental } from '../lib/features'

export default function RGDDetail() {
  const { capabilities } = useCapabilities()
  const showRevisions = capabilities.knownResources.includes('graphrevisions')
  const experimental = isExperimental()

  return (
    <div>
      <div>TODO: RGDDetail</div>
      {showRevisions && (
        <div
          style={{
            padding: '8px',
            marginTop: '16px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
          }}
        >
          {experimental && (
            <span
              style={{
                fontSize: '12px',
                color: 'var(--color-status-warning)',
                marginRight: '8px',
              }}
            >
              Experimental
            </span>
          )}
          Revisions (placeholder — delivered by spec 009-rgd-graph-diff)
        </div>
      )}
    </div>
  )
}
