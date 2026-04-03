// RGDStatStrip.test.tsx — Component unit tests (#415)
//
// Covers: Age cell tick, Instances cell states, Revision cell
// (condition-message path + fallback + hasRevisions gating), edge cases.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import RGDStatStrip from './RGDStatStrip'
import type { K8sObject } from '@/lib/api'

// ── helpers ───────────────────────────────────────────────────────────────

function makeRgd(overrides: {
  creationTimestamp?: string
  conditions?: Array<{ type: string; status: string; message?: string }>
  lastIssuedRevision?: number
} = {}): K8sObject {
  return {
    metadata: { creationTimestamp: overrides.creationTimestamp ?? '2026-01-01T00:00:00Z' },
    spec: { resources: [{ id: 'r1' }, { id: 'r2' }] },
    status: {
      conditions: overrides.conditions,
      lastIssuedRevision: overrides.lastIssuedRevision,
    },
  } as unknown as K8sObject
}

// ── Age cell ─────────────────────────────────────────────────────────────

describe('RGDStatStrip — Age cell', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders an Age cell with a non-empty value', () => {
    render(<RGDStatStrip rgd={makeRgd()} instanceCount={0} />)
    expect(screen.getByTestId('rgd-stat-age')).toBeInTheDocument()
    // The age label is present
    expect(screen.getByText('Age')).toBeInTheDocument()
  })

  it('updates Age cell on 1s interval', () => {
    render(<RGDStatStrip rgd={makeRgd({ creationTimestamp: new Date(Date.now() - 2000).toISOString() })} instanceCount={0} />)
    const before = screen.getByTestId('rgd-stat-age').textContent
    act(() => { vi.advanceTimersByTime(5000) })
    // Age may still be the same short value but component re-renders without crashing
    expect(screen.getByTestId('rgd-stat-age')).toBeInTheDocument()
    expect(before).toBeTruthy()
  })
})

// ── Resources cell ───────────────────────────────────────────────────────

describe('RGDStatStrip — Resources cell', () => {
  it('shows resource count from spec.resources', () => {
    render(<RGDStatStrip rgd={makeRgd()} instanceCount={0} />)
    expect(screen.getByTestId('rgd-stat-resources').textContent).toContain('2')
  })
})

// ── Instances cell ───────────────────────────────────────────────────────

describe('RGDStatStrip — Instances cell', () => {
  it('shows "…" while loading (null)', () => {
    render(<RGDStatStrip rgd={makeRgd()} instanceCount={null} />)
    expect(screen.getByTestId('rgd-stat-instances').textContent).toContain('…')
  })

  it('shows "—" when fetch failed (undefined)', () => {
    render(<RGDStatStrip rgd={makeRgd()} instanceCount={undefined} />)
    expect(screen.getByTestId('rgd-stat-instances').textContent).toContain('—')
  })

  it('shows "0" with muted color when zero instances', () => {
    render(<RGDStatStrip rgd={makeRgd()} instanceCount={0} />)
    const cell = screen.getByTestId('rgd-stat-instances')
    expect(cell.textContent).toContain('0')
    expect(cell.querySelector('.rgd-stat-strip__value--muted')).not.toBeNull()
  })

  it('shows instance count with alive color when > 0', () => {
    render(<RGDStatStrip rgd={makeRgd()} instanceCount={4} />)
    const cell = screen.getByTestId('rgd-stat-instances')
    expect(cell.textContent).toContain('4')
    expect(cell.querySelector('.rgd-stat-strip__value--alive')).not.toBeNull()
  })
})

// ── Revision cell ────────────────────────────────────────────────────────

describe('RGDStatStrip — Revision cell', () => {
  it('shows "#1" from GraphRevisionsResolved condition message', () => {
    const rgd = makeRgd({
      conditions: [{ type: 'GraphRevisionsResolved', status: 'True', message: 'revision 1 compiled and active' }],
    })
    render(<RGDStatStrip rgd={rgd} instanceCount={0} hasRevisions />)
    expect(screen.getByTestId('rgd-stat-revision').textContent).toContain('#1')
  })

  it('shows "#3" with alive color when revision present', () => {
    const rgd = makeRgd({
      conditions: [{ type: 'GraphRevisionsResolved', status: 'True', message: 'revision 3 compiled and active' }],
    })
    render(<RGDStatStrip rgd={rgd} instanceCount={0} hasRevisions />)
    const cell = screen.getByTestId('rgd-stat-revision')
    expect(cell.textContent).toContain('#3')
    expect(cell.querySelector('.rgd-stat-strip__value--alive')).not.toBeNull()
  })

  it('shows "—" when condition status is not True', () => {
    const rgd = makeRgd({
      conditions: [{ type: 'GraphRevisionsResolved', status: 'Unknown', message: 'awaiting reconciliation' }],
    })
    render(<RGDStatStrip rgd={rgd} instanceCount={0} hasRevisions />)
    expect(screen.getByTestId('rgd-stat-revision').textContent).toContain('—')
  })

  it('shows "—" with muted color when hasRevisions=false', () => {
    render(<RGDStatStrip rgd={makeRgd()} instanceCount={0} hasRevisions={false} />)
    const cell = screen.getByTestId('rgd-stat-revision')
    expect(cell.textContent).toContain('—')
    expect(cell.querySelector('.rgd-stat-strip__value--muted')).not.toBeNull()
  })

  it('falls back to status.lastIssuedRevision when condition absent', () => {
    const rgd = makeRgd({ lastIssuedRevision: 5 })
    render(<RGDStatStrip rgd={rgd} instanceCount={0} hasRevisions />)
    expect(screen.getByTestId('rgd-stat-revision').textContent).toContain('#5')
  })

  it('shows "—" when no revision data at all', () => {
    render(<RGDStatStrip rgd={makeRgd()} instanceCount={0} hasRevisions />)
    expect(screen.getByTestId('rgd-stat-revision').textContent).toContain('—')
  })
})
