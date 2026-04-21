// Copyright 2026 The Kubernetes Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import InstancesPage from './Instances'

// ── Mock API ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  listAllInstances: vi.fn(),
}))

import { listAllInstances } from '@/lib/api'

const mockedList = vi.mocked(listAllInstances)

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeInstance(
  name: string,
  overrides: {
    namespace?: string
    kind?: string
    rgdName?: string
    state?: string
    ready?: string
    creationTimestamp?: string
    message?: string
  } = {},
) {
  return {
    name,
    namespace: overrides.namespace ?? 'default',
    kind: overrides.kind ?? 'WebApp',
    rgdName: overrides.rgdName ?? 'test-app',
    state: overrides.state ?? '',
    ready: overrides.ready ?? 'True',
    creationTimestamp: overrides.creationTimestamp ?? '2026-01-01T00:00:00Z',
    message: overrides.message ?? '',
  }
}

function renderPage(initialRoute = '/instances') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <InstancesPage />
    </MemoryRouter>,
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('InstancesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Loading state ──────────────────────────────────────────────

  it('shows loading message while fetching', () => {
    mockedList.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/Loading instances/i)).toBeInTheDocument()
  })

  // ── Error state ────────────────────────────────────────────────

  it('shows error and retry button on fetch failure', async () => {
    mockedList.mockRejectedValue(new Error('connection refused'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('retry button re-fetches instances', async () => {
    const user = userEvent.setup()
    mockedList
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ items: [makeInstance('my-app')], total: 0 })

    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => {
      expect(screen.getByTestId('instances-table')).toBeInTheDocument()
    })
  })

  // ── Empty state ────────────────────────────────────────────────

  it('shows empty state when no instances returned', async () => {
    mockedList.mockResolvedValue({ items: [], total: 0 })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/No instances found across any RGD/i)).toBeInTheDocument()
    })
  })

  // ── Table render ───────────────────────────────────────────────

  it('renders the instances table with rows', async () => {
    mockedList.mockResolvedValue({
      items: [makeInstance('app-1'), makeInstance('app-2')], total: 0,
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('instances-table')).toBeInTheDocument()
    })
    expect(screen.getAllByTestId('instances-row')).toHaveLength(2)
  })

  it('renders page title as Instances', () => {
    mockedList.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.title).toBe('Instances — kro-ui')
  })

  // ── Search filter ──────────────────────────────────────────────

  it('filters by instance name (case-insensitive)', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({
      items: [
        makeInstance('my-app'),
        makeInstance('other-service'),
      ], total: 0,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-table')).toBeInTheDocument())

    await user.type(screen.getByTestId('instances-search'), 'my-app')

    await waitFor(() => {
      const rows = screen.getAllByTestId('instances-row')
      expect(rows).toHaveLength(1)
      expect(rows[0].textContent).toContain('my-app')
    })
  })

  it('filters by RGD name', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({
      items: [
        makeInstance('app-1', { rgdName: 'webapp-rgd' }),
        makeInstance('app-2', { rgdName: 'database-rgd' }),
      ], total: 0,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-table')).toBeInTheDocument())

    await user.type(screen.getByTestId('instances-search'), 'database')

    await waitFor(() => {
      const rows = screen.getAllByTestId('instances-row')
      expect(rows).toHaveLength(1)
      expect(rows[0].textContent).toContain('database-rgd')
    })
  })

  it('shows empty filter message when search has no results', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({
      items: [makeInstance('my-app')], total: 0,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-table')).toBeInTheDocument())

    await user.type(screen.getByTestId('instances-search'), 'zzznotfound')

    await waitFor(() => {
      expect(screen.getByText(/No instances match the current filters/i)).toBeInTheDocument()
    })
  })

  // ── Health state mapping ───────────────────────────────────────

  it('maps state=IN_PROGRESS to reconciling (not error)', async () => {
    mockedList.mockResolvedValue({
      items: [makeInstance('app-1', { state: 'IN_PROGRESS', ready: 'False' })], total: 0,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-table')).toBeInTheDocument())

    // Health filter chip for reconciling should show count=1
    const reconcilingChip = screen.getByTestId('instances-health-chip-reconciling')
    expect(reconcilingChip.textContent).toContain('1')
  })

  it('maps ready=False (non IN_PROGRESS) to error', async () => {
    mockedList.mockResolvedValue({
      items: [makeInstance('app-1', { state: '', ready: 'False' })], total: 0,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-table')).toBeInTheDocument())

    const errorChip = screen.getByTestId('instances-health-chip-error')
    expect(errorChip.textContent).toContain('1')
  })

  it('maps ready=True to ready', async () => {
    mockedList.mockResolvedValue({
      items: [makeInstance('app-1', { ready: 'True' })], total: 0,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-table')).toBeInTheDocument())

    const readyChip = screen.getByTestId('instances-health-chip-ready')
    expect(readyChip.textContent).toContain('1')
  })

  // ── Health filter chips ────────────────────────────────────────

  it('health filter chips are shown after data loads', async () => {
    mockedList.mockResolvedValue({
      items: [makeInstance('app-1')], total: 0,
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('instances-health-chip-all')).toBeInTheDocument()
    })
  })

  it('clicking a health chip filters the table', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({
      items: [
        makeInstance('good', { ready: 'True' }),
        makeInstance('bad', { state: '', ready: 'False' }),
      ], total: 0,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-table')).toBeInTheDocument())

    await user.click(screen.getByTestId('instances-health-chip-error'))

    await waitFor(() => {
      const rows = screen.getAllByTestId('instances-row')
      expect(rows).toHaveLength(1)
      expect(rows[0].textContent).toContain('bad')
    })
  })

  it('All chip restores full list', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({
      items: [
        makeInstance('good', { ready: 'True' }),
        makeInstance('bad', { state: '', ready: 'False' }),
      ], total: 0,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-table')).toBeInTheDocument())

    await user.click(screen.getByTestId('instances-health-chip-error'))
    await waitFor(() => expect(screen.getAllByTestId('instances-row')).toHaveLength(1))

    await user.click(screen.getByTestId('instances-health-chip-all'))
    await waitFor(() => expect(screen.getAllByTestId('instances-row')).toHaveLength(2))
  })

  // ── Count display ──────────────────────────────────────────────

  it('displays instance count', async () => {
    mockedList.mockResolvedValue({
      items: [makeInstance('a'), makeInstance('b'), makeInstance('c')], total: 0,
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('instances-count')).toBeInTheDocument()
    })
    expect(screen.getByTestId('instances-count').textContent).toContain('3')
  })

  // ── Namespace filter ───────────────────────────────────────────

  it('renders namespace dropdown when multiple namespaces are present', async () => {
    mockedList.mockResolvedValue({
      items: [
        makeInstance('a', { namespace: 'ns-1' }),
        makeInstance('b', { namespace: 'ns-2' }),
      ], total: 0,
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('instances-ns-filter')).toBeInTheDocument()
    })
  })

  it('does not render namespace dropdown when all instances are in one namespace', async () => {
    mockedList.mockResolvedValue({
      items: [
        makeInstance('a', { namespace: 'default' }),
        makeInstance('b', { namespace: 'default' }),
      ], total: 0,
    })
    renderPage()
    await waitFor(() => {
      // Table should be rendered
      expect(screen.getByTestId('instances-table')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('instances-ns-filter')).not.toBeInTheDocument()
  })

  // ── Pagination ─────────────────────────────────────────────────

  it('shows pagination when more than 50 instances exist', async () => {
    const items = Array.from({ length: 55 }, (_, i) => makeInstance(`app-${i}`))
    mockedList.mockResolvedValue({ items, total: 0 })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument()
    })
  })

  it('does not show pagination for 50 or fewer instances', async () => {
    const items = Array.from({ length: 50 }, (_, i) => makeInstance(`app-${i}`))
    mockedList.mockResolvedValue({ items, total: 0 })
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('instances-table')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Page 1 of/i)).not.toBeInTheDocument()
  })

  // ── Sort ───────────────────────────────────────────────────────

  it('table has sortable column headers with aria-sort', async () => {
    mockedList.mockResolvedValue({
      items: [makeInstance('a')], total: 0,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-table')).toBeInTheDocument())

    // Default sort is 'health' ascending
    const headers = screen.getAllByRole('columnheader')
    const sortedHeader = headers.find((h) => h.getAttribute('aria-sort') === 'ascending')
    expect(sortedHeader).toBeTruthy()
  })

  // ── URL param sync ─────────────────────────────────────────────

  it('reads health filter from ?health= URL param on mount', async () => {
    mockedList.mockResolvedValue({
      items: [
        makeInstance('good', { ready: 'True' }),
        makeInstance('bad', { state: '', ready: 'False' }),
      ], total: 0,
    })
    renderPage('/instances?health=error')
    await waitFor(() => expect(screen.getByTestId('instances-table')).toBeInTheDocument())

    // Only the error instance should be visible
    await waitFor(() => {
      const rows = screen.getAllByTestId('instances-row')
      expect(rows).toHaveLength(1)
      expect(rows[0].textContent).toContain('bad')
    })
  })
})

// ── spec issue-536: bulk operations ────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  listAllInstances: vi.fn(),
  getInstance: vi.fn(),
}))

describe('InstancesPage bulk operations (spec issue-536)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "Select" button when instances are loaded', async () => {
    mockedList.mockResolvedValue({
      items: [makeInstance('alpha'), makeInstance('beta')],
      total: 2,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-select-btn')).toBeInTheDocument())
  })

  it('does not show "Select" button while loading', () => {
    mockedList.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.queryByTestId('instances-select-btn')).toBeNull()
  })

  it('entering selection mode shows toolbar and checkbox column', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({
      items: [makeInstance('alpha'), makeInstance('beta')],
      total: 2,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-select-btn')).toBeInTheDocument())

    await user.click(screen.getByTestId('instances-select-btn'))

    expect(screen.getByTestId('instances-selection-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('instances-selection-count').textContent).toBe('0 selected')
    // Checkboxes appear
    expect(screen.getAllByTestId(/instances-row-check-/)).toHaveLength(2)
  })

  it('selects and deselects individual rows', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({
      items: [makeInstance('alpha'), makeInstance('beta')],
      total: 2,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-select-btn')).toBeInTheDocument())
    await user.click(screen.getByTestId('instances-select-btn'))

    await user.click(screen.getByTestId('instances-row-check-alpha'))
    expect(screen.getByTestId('instances-selection-count').textContent).toBe('1 selected')

    await user.click(screen.getByTestId('instances-row-check-alpha'))
    expect(screen.getByTestId('instances-selection-count').textContent).toBe('0 selected')
  })

  it('"Select all" selects all visible rows', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({
      items: [makeInstance('alpha'), makeInstance('beta')],
      total: 2,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-select-btn')).toBeInTheDocument())
    await user.click(screen.getByTestId('instances-select-btn'))

    await user.click(screen.getByTestId('instances-select-all').querySelector('input')!)
    expect(screen.getByTestId('instances-selection-count').textContent).toBe('2 selected')
  })

  it('"Clear" exits selection mode', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({
      items: [makeInstance('alpha')],
      total: 1,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-select-btn')).toBeInTheDocument())
    await user.click(screen.getByTestId('instances-select-btn'))
    expect(screen.getByTestId('instances-selection-toolbar')).toBeInTheDocument()

    await user.click(screen.getByTestId('instances-selection-clear'))
    expect(screen.queryByTestId('instances-selection-toolbar')).toBeNull()
    expect(screen.getByTestId('instances-select-btn')).toBeInTheDocument()
  })

  it('Export YAML button is disabled when nothing selected', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({
      items: [makeInstance('alpha')],
      total: 1,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-select-btn')).toBeInTheDocument())
    await user.click(screen.getByTestId('instances-select-btn'))

    expect(screen.getByTestId('instances-export-yaml')).toBeDisabled()
  })

  it('Export YAML button is enabled when rows selected', async () => {
    const user = userEvent.setup()
    mockedList.mockResolvedValue({
      items: [makeInstance('alpha')],
      total: 1,
    })
    renderPage()
    await waitFor(() => expect(screen.getByTestId('instances-select-btn')).toBeInTheDocument())
    await user.click(screen.getByTestId('instances-select-btn'))
    await user.click(screen.getByTestId('instances-row-check-alpha'))

    expect(screen.getByTestId('instances-export-yaml')).not.toBeDisabled()
  })
})
