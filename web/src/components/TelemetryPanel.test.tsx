// TelemetryPanel.test.tsx — Component render tests + timer tests.
//
// T007: Component render tests (US2 — graceful degradation + US1 — health summary)
// T009: Timer tests (US3 — live ticking, no memory leaks)
//
// Tests spec 027-instance-telemetry-panel acceptance scenarios.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import TelemetryPanel from './TelemetryPanel'
import type { NodeStateMap } from '@/lib/instanceNodeState'
import type { K8sList } from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeInstance(overrides: {
  creationTimestamp?: string
  conditions?: Array<{ type: string; status: string; lastTransitionTime?: string }>
}) {
  return {
    metadata: overrides.creationTimestamp != null
      ? { creationTimestamp: overrides.creationTimestamp }
      : {},
    status: overrides.conditions != null
      ? { conditions: overrides.conditions }
      : {},
  }
}

function makeNodeStateMap(
  entries: Array<{ kind: string; state: 'alive' | 'reconciling' | 'error' | 'not-found' }>,
): NodeStateMap {
  const map: NodeStateMap = {}
  for (const e of entries) {
    map[e.kind.toLowerCase()] = {
      state: e.state,
      kind: e.kind,
      name: `${e.kind.toLowerCase()}-1`,
      namespace: 'default',
      group: '',
      version: 'v1',
    }
  }
  return map
}

function makeEvents(types: string[]): K8sList {
  return {
    items: types.map((t) => ({ type: t })),
    metadata: {},
  }
}

const emptyInstance = makeInstance({})
const emptyMap: NodeStateMap = {}
const emptyEvents = makeEvents([])

// ── T007: Component render tests ─────────────────────────────────────────

describe('TelemetryPanel (T007 — component render)', () => {
  beforeEach(() => {
    // Use fake timers to prevent real setInterval from running in tests
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-23T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders all 4 metric cells', () => {
    render(
      <TelemetryPanel
        instance={emptyInstance}
        nodeStateMap={emptyMap}
        events={emptyEvents}
      />,
    )
    expect(screen.getByTestId('telemetry-panel')).toBeInTheDocument()
    expect(screen.getByTestId('telemetry-cell-age')).toBeInTheDocument()
    expect(screen.getByTestId('telemetry-cell-time-in-state')).toBeInTheDocument()
    expect(screen.getByTestId('telemetry-cell-children')).toBeInTheDocument()
    expect(screen.getByTestId('telemetry-cell-warnings')).toBeInTheDocument()
  })

  it('shows formatAge result for age when creationTimestamp is present', () => {
    // 2 hours before fake now
    const instance = makeInstance({ creationTimestamp: '2026-03-23T10:00:00Z' })
    render(
      <TelemetryPanel instance={instance} nodeStateMap={emptyMap} events={emptyEvents} />,
    )
    const ageCell = screen.getByTestId('telemetry-cell-age')
    expect(ageCell).toHaveTextContent('2h')
    expect(ageCell).toHaveTextContent('Age')
  })

  it('shows "Not reported" when creationTimestamp is missing', () => {
    const instance = makeInstance({})
    render(
      <TelemetryPanel instance={instance} nodeStateMap={emptyMap} events={emptyEvents} />,
    )
    expect(screen.getByTestId('telemetry-cell-age')).toHaveTextContent('Not reported')
  })

  it('shows "Not reported" for time-in-state when Ready condition is absent', () => {
    const instance = makeInstance({
      conditions: [{ type: 'Progressing', status: 'True' }],
    })
    render(
      <TelemetryPanel instance={instance} nodeStateMap={emptyMap} events={emptyEvents} />,
    )
    expect(screen.getByTestId('telemetry-cell-time-in-state')).toHaveTextContent('Not reported')
  })

  it('shows time-in-state from Ready.lastTransitionTime when present', () => {
    // 30 minutes before fake now
    const instance = makeInstance({
      conditions: [
        { type: 'Ready', status: 'True', lastTransitionTime: '2026-03-23T11:30:00Z' },
      ],
    })
    render(
      <TelemetryPanel instance={instance} nodeStateMap={emptyMap} events={emptyEvents} />,
    )
    expect(screen.getByTestId('telemetry-cell-time-in-state')).toHaveTextContent('30m')
  })

  it('shows healthy fraction with alive color class when all children healthy', () => {
    const map = makeNodeStateMap([
      { kind: 'Deployment', state: 'alive' },
      { kind: 'Service', state: 'alive' },
    ])
    render(
      <TelemetryPanel instance={emptyInstance} nodeStateMap={map} events={emptyEvents} />,
    )
    const cell = screen.getByTestId('telemetry-cell-children')
    expect(cell).toHaveTextContent('2/2')
    // The value span should have the alive modifier class
    const valueSpan = cell.querySelector('.telemetry-panel__value')
    expect(valueSpan).toHaveClass('telemetry-panel__value--alive')
  })

  it('shows fraction with error color class when any child has error state', () => {
    const map = makeNodeStateMap([
      { kind: 'Deployment', state: 'error' },
      { kind: 'Service', state: 'alive' },
    ])
    render(
      <TelemetryPanel instance={emptyInstance} nodeStateMap={map} events={emptyEvents} />,
    )
    const cell = screen.getByTestId('telemetry-cell-children')
    expect(cell).toHaveTextContent('1/2')
    const valueSpan = cell.querySelector('.telemetry-panel__value')
    expect(valueSpan).toHaveClass('telemetry-panel__value--error')
  })

  it('shows 0/0 with muted color class when nodeStateMap is empty', () => {
    render(
      <TelemetryPanel instance={emptyInstance} nodeStateMap={{}} events={emptyEvents} />,
    )
    const cell = screen.getByTestId('telemetry-cell-children')
    expect(cell).toHaveTextContent('0/0')
    const valueSpan = cell.querySelector('.telemetry-panel__value')
    expect(valueSpan).toHaveClass('telemetry-panel__value--muted')
  })

  it('shows warning count with warning color class when count > 0', () => {
    const events = makeEvents(['Warning', 'Warning', 'Normal'])
    render(
      <TelemetryPanel instance={emptyInstance} nodeStateMap={emptyMap} events={events} />,
    )
    const cell = screen.getByTestId('telemetry-cell-warnings')
    expect(cell).toHaveTextContent('2')
    const valueSpan = cell.querySelector('.telemetry-panel__value')
    expect(valueSpan).toHaveClass('telemetry-panel__value--warning')
  })

  it('shows 0 with muted color class when no warnings', () => {
    render(
      <TelemetryPanel instance={emptyInstance} nodeStateMap={emptyMap} events={emptyEvents} />,
    )
    const cell = screen.getByTestId('telemetry-cell-warnings')
    expect(cell).toHaveTextContent('0')
    const valueSpan = cell.querySelector('.telemetry-panel__value')
    expect(valueSpan).toHaveClass('telemetry-panel__value--muted')
  })

  it('renders reconciling children as healthy (alive color)', () => {
    const map = makeNodeStateMap([
      { kind: 'Deployment', state: 'reconciling' },
    ])
    render(
      <TelemetryPanel instance={emptyInstance} nodeStateMap={map} events={emptyEvents} />,
    )
    const cell = screen.getByTestId('telemetry-cell-children')
    expect(cell).toHaveTextContent('1/1')
    const valueSpan = cell.querySelector('.telemetry-panel__value')
    expect(valueSpan).toHaveClass('telemetry-panel__value--alive')
  })

  it('panel has accessible role and label', () => {
    render(
      <TelemetryPanel instance={emptyInstance} nodeStateMap={emptyMap} events={emptyEvents} />,
    )
    const panel = screen.getByRole('status', { name: 'Instance telemetry' })
    expect(panel).toBeInTheDocument()
  })
})

// ── T009: Timer tests (US3 — live ticking, no memory leaks) ──────────────

describe('TelemetryPanel timer (T009 — US3)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-23T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('calls setInterval once on mount with 1000ms interval', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    render(
      <TelemetryPanel instance={emptyInstance} nodeStateMap={emptyMap} events={emptyEvents} />,
    )
    // The component calls setInterval with 1000ms
    const calls = setIntervalSpy.mock.calls
    const timerCall = calls.find((args: unknown[]) => args[1] === 1000)
    expect(timerCall).toBeDefined()
  })

  it('calls clearInterval on unmount — no memory leak', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const { unmount } = render(
      <TelemetryPanel instance={emptyInstance} nodeStateMap={emptyMap} events={emptyEvents} />,
    )
    expect(clearIntervalSpy).not.toHaveBeenCalled()
    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('age display updates after 1 second tick', () => {
    // Instance created 59 seconds before "now" → shows 59s
    const instance = makeInstance({ creationTimestamp: '2026-03-23T11:59:01Z' })
    const { rerender } = render(
      <TelemetryPanel instance={instance} nodeStateMap={emptyMap} events={emptyEvents} />,
    )

    // Before tick: 59s
    expect(screen.getByTestId('telemetry-cell-age')).toHaveTextContent('59s')

    // Advance 1 second → now 60s → formatAge returns '1m'
    vi.advanceTimersByTime(1000)
    vi.setSystemTime(new Date('2026-03-23T12:00:01Z'))

    // Trigger re-render by re-passing the same props (tick state will have incremented)
    rerender(
      <TelemetryPanel instance={instance} nodeStateMap={emptyMap} events={emptyEvents} />,
    )
    expect(screen.getByTestId('telemetry-cell-age')).toHaveTextContent('1m')
  })
})
