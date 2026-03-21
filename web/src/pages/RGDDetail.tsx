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
            padding: 'var(--space-sm)',
            marginTop: 'var(--space-md)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {experimental && (
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-warning)',
                marginRight: 'var(--space-xs)',
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
