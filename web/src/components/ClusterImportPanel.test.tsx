// ClusterImportPanel.test.tsx — Tests for the "Load from Cluster" panel.
//
// Spec: .specify/specs/issue-542/spec.md FR-001–FR-010

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ClusterImportPanel from './ClusterImportPanel'

// ── API mock ───────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  listRGDs: vi.fn(),
  getRGD: vi.fn(),
}))

import * as api from '@/lib/api'
const mockedListRGDs = vi.mocked(api.listRGDs)
const mockedGetRGD = vi.mocked(api.getRGD)

// A minimal valid K8s RGD object that toYaml + parseRGDYAML can handle
const MOCK_RGD_OBJECT = {
  apiVersion: 'kro.run/v1alpha1',
  kind: 'ResourceGraphDefinition',
  metadata: { name: 'test-app' },
  spec: {
    schema: {
      kind: 'TestApp',
      apiVersion: 'v1alpha1',
    },
    resources: [],
  },
}

const MOCK_RGD_LIST = {
  items: [
    { metadata: { name: 'test-app' } },
    { metadata: { name: 'another-rgd' } },
  ],
  metadata: {},
}

// ── FR-007: do not fetch on mount ─────────────────────────────────────────

describe('ClusterImportPanel: no fetch on mount (FR-007)', () => {
  beforeEach(() => {
    mockedListRGDs.mockClear()
    mockedGetRGD.mockClear()
  })

  it('does not call listRGDs on mount', () => {
    render(<ClusterImportPanel onImport={vi.fn()} />)
    expect(mockedListRGDs).not.toHaveBeenCalled()
  })

  it('panel body is not visible by default (FR-001 collapsed state)', () => {
    render(<ClusterImportPanel onImport={vi.fn()} />)
    expect(screen.queryByTestId('cluster-import-select')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cluster-import-load')).not.toBeInTheDocument()
  })
})

// ── FR-001, FR-002: expand and list RGDs ──────────────────────────────────

describe('ClusterImportPanel: expand and list RGDs (FR-001, FR-002)', () => {
  beforeEach(() => {
    mockedListRGDs.mockClear()
    mockedGetRGD.mockClear()
    mockedListRGDs.mockResolvedValue(MOCK_RGD_LIST as ReturnType<typeof api.listRGDs> extends Promise<infer T> ? T : never)
  })

  it('clicking toggle shows "Loading RGDs..." then the dropdown', async () => {
    render(<ClusterImportPanel onImport={vi.fn()} />)
    fireEvent.click(screen.getByTestId('cluster-import-toggle'))
    expect(screen.getByTestId('cluster-import-loading')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('cluster-import-select')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('cluster-import-loading')).not.toBeInTheDocument()
  })

  it('dropdown contains names from listRGDs response (FR-002)', async () => {
    render(<ClusterImportPanel onImport={vi.fn()} />)
    fireEvent.click(screen.getByTestId('cluster-import-toggle'))

    await waitFor(() => {
      expect(screen.getByTestId('cluster-import-select')).toBeInTheDocument()
    })

    const select = screen.getByTestId('cluster-import-select') as HTMLSelectElement
    const options = Array.from(select.options).map((o) => o.value)
    expect(options).toContain('another-rgd')
    expect(options).toContain('test-app')
  })

  it('aria-expanded toggles correctly', async () => {
    render(<ClusterImportPanel onImport={vi.fn()} />)
    const toggle = screen.getByTestId('cluster-import-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // Wait for dropdown to load before toggling again
    await waitFor(() => {
      expect(screen.getByTestId('cluster-import-select')).toBeInTheDocument()
    })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})

// ── FR-005: empty cluster ──────────────────────────────────────────────────

describe('ClusterImportPanel: empty cluster (FR-005)', () => {
  beforeEach(() => {
    mockedListRGDs.mockClear()
    mockedListRGDs.mockResolvedValue({ items: [], metadata: {} } as ReturnType<typeof api.listRGDs> extends Promise<infer T> ? T : never)
  })

  it('shows "No RGDs found" when cluster has no RGDs (FR-005)', async () => {
    render(<ClusterImportPanel onImport={vi.fn()} />)
    fireEvent.click(screen.getByTestId('cluster-import-toggle'))

    await waitFor(() => {
      expect(screen.getByTestId('cluster-import-empty')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('cluster-import-select')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cluster-import-load')).not.toBeInTheDocument()
  })
})

// ── FR-004: list error ─────────────────────────────────────────────────────

describe('ClusterImportPanel: list error (FR-004)', () => {
  beforeEach(() => {
    mockedListRGDs.mockClear()
    mockedListRGDs.mockRejectedValue(new Error('Network error'))
  })

  it('shows inline error on list failure (FR-004)', async () => {
    render(<ClusterImportPanel onImport={vi.fn()} />)
    fireEvent.click(screen.getByTestId('cluster-import-toggle'))

    await waitFor(() => {
      expect(screen.getByTestId('cluster-import-list-error')).toBeInTheDocument()
    })
    expect(screen.getByTestId('cluster-import-list-error')).toHaveTextContent('Network error')
    expect(screen.queryByTestId('cluster-import-select')).not.toBeInTheDocument()
  })
})

// ── FR-003, FR-006: load and apply ────────────────────────────────────────

describe('ClusterImportPanel: load and apply (FR-003, FR-006)', () => {
  beforeEach(() => {
    mockedListRGDs.mockClear()
    mockedGetRGD.mockClear()
    mockedListRGDs.mockResolvedValue(MOCK_RGD_LIST as ReturnType<typeof api.listRGDs> extends Promise<infer T> ? T : never)
    mockedGetRGD.mockResolvedValue(MOCK_RGD_OBJECT as ReturnType<typeof api.getRGD> extends Promise<infer T> ? T : never)
  })

  it('clicking Load fetches RGD by selected name (FR-003)', async () => {
    const onImport = vi.fn()
    render(<ClusterImportPanel onImport={onImport} />)
    fireEvent.click(screen.getByTestId('cluster-import-toggle'))

    await waitFor(() => {
      expect(screen.getByTestId('cluster-import-select')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('cluster-import-load'))

    await waitFor(() => {
      expect(mockedGetRGD).toHaveBeenCalledOnce()
    })
    expect(onImport).toHaveBeenCalledOnce()
    // Imported state should have rgdName from the mock RGD
    const importedState = onImport.mock.calls[0][0]
    expect(importedState.rgdName).toBe('test-app')
  })

  it('Load button is disabled while loading (FR-006)', async () => {
    // Simulate slow response
    let resolveGetRGD!: (v: ReturnType<typeof api.getRGD> extends Promise<infer T> ? T : never) => void
    mockedGetRGD.mockImplementation(() => new Promise((r) => { resolveGetRGD = r }))

    render(<ClusterImportPanel onImport={vi.fn()} />)
    fireEvent.click(screen.getByTestId('cluster-import-toggle'))

    await waitFor(() => {
      expect(screen.getByTestId('cluster-import-select')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('cluster-import-load'))
    expect(screen.getByTestId('cluster-import-load')).toBeDisabled()

    // Resolve the promise
    resolveGetRGD(MOCK_RGD_OBJECT as ReturnType<typeof api.getRGD> extends Promise<infer T> ? T : never)
    await waitFor(() => {
      expect(screen.queryByTestId('cluster-import-load')).not.toBeInTheDocument()
    })
  })

  it('collapses panel after successful load', async () => {
    render(<ClusterImportPanel onImport={vi.fn()} />)
    fireEvent.click(screen.getByTestId('cluster-import-toggle'))

    await waitFor(() => {
      expect(screen.getByTestId('cluster-import-select')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('cluster-import-load'))

    await waitFor(() => {
      expect(screen.queryByTestId('cluster-import-select')).not.toBeInTheDocument()
    })
  })
})

// ── FR-004: load error ────────────────────────────────────────────────────

describe('ClusterImportPanel: load error (FR-004)', () => {
  beforeEach(() => {
    mockedListRGDs.mockClear()
    mockedGetRGD.mockClear()
    mockedListRGDs.mockResolvedValue(MOCK_RGD_LIST as ReturnType<typeof api.listRGDs> extends Promise<infer T> ? T : never)
    mockedGetRGD.mockRejectedValue(new Error('Cluster unreachable'))
  })

  it('shows inline error on load failure, does not call onImport (FR-004)', async () => {
    const onImport = vi.fn()
    render(<ClusterImportPanel onImport={onImport} />)
    fireEvent.click(screen.getByTestId('cluster-import-toggle'))

    await waitFor(() => {
      expect(screen.getByTestId('cluster-import-select')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('cluster-import-load'))

    await waitFor(() => {
      expect(screen.getByTestId('cluster-import-load-error')).toBeInTheDocument()
    })
    expect(screen.getByTestId('cluster-import-load-error')).toHaveTextContent('Cluster unreachable')
    expect(onImport).not.toHaveBeenCalled()
  })
})
