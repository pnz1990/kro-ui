import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { getRGD } from "@/lib/api"
import type { K8sObject } from "@/lib/api"
import { toYaml } from "@/lib/yaml"
import KroCodeBlock from "@/components/KroCodeBlock"
import { useCapabilities, isExperimental } from "@/lib/features"

/**
 * RGDDetail — Shows an RGD with a YAML tab for highlighted source.
 *
 * Minimal implementation to support the CEL highlighter (spec 006).
 * Full DAG view, instances tab, and node inspection are in specs 003/005.
 * Revisions tab is capabilities-gated on knownResources (spec 008).
 */
export default function RGDDetail() {
  const { name } = useParams<{ name: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get("tab") ?? "overview"
  const { capabilities } = useCapabilities()
  const showRevisions = capabilities.knownResources.includes("graphrevisions")
  const experimental = isExperimental()

  const [rgd, setRgd] = useState<K8sObject | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!name) return
    setLoading(true)
    getRGD(name)
      .then((data) => {
        setRgd(data)
        setError(null)
      })
      .catch((err: Error) => {
        setError(err.message)
        setRgd(null)
      })
      .finally(() => setLoading(false))
  }, [name])

  if (loading) {
    return (
      <div style={{ padding: 32, color: "var(--color-text-muted)" }}>
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32, color: "var(--color-error)" }}>
        Error: {error}
      </div>
    )
  }

  if (!rgd) return null

  const rgdName =
    (rgd.metadata as Record<string, unknown> | undefined)?.name ?? name ?? ""

  return (
    <div style={{ padding: 32 }}>
      <h1
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: "var(--color-text)",
          marginBottom: 16,
        }}
      >
        {String(rgdName)}
      </h1>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 24,
        }}
      >
        <TabButton
          label="Overview"
          active={tab === "overview"}
          onClick={() => setSearchParams({})}
        />
        <TabButton
          label="YAML"
          active={tab === "yaml"}
          onClick={() => setSearchParams({ tab: "yaml" })}
        />
      </div>

      {/* Tab content */}
      {tab === "yaml" && (
        <KroCodeBlock
          code={toYaml(rgd)}
          title="ResourceGraphDefinition"
        />
      )}

      {tab === "overview" && (
        <div style={{ color: "var(--color-text-muted)" }}>
          TODO: DAG view and resource overview (specs 003/005)
        </div>
      )}

      {/* Revisions tab — capabilities-gated on knownResources (spec 008/009) */}
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

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        padding: "8px 16px",
        background: "transparent",
        border: "none",
        borderBottom: active
          ? "2px solid var(--color-primary)"
          : "2px solid transparent",
        color: active ? "var(--color-text)" : "var(--color-text-muted)",
        fontWeight: active ? 500 : 400,
        cursor: "pointer",
        transition: "color 80ms ease, border-color 80ms ease",
      }}
    >
      {label}
    </button>
  )
}
