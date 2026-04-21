// ResourceGraphPanel.test.tsx — Unit tests for the resource graph panel.
//
// Spec: .specify/specs/issue-538/spec.md O1–O7

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ResourceGraphPanel from './ResourceGraphPanel'
import type { K8sObject } from '@/lib/api'

// ── Mock data ──────────────────────────────────────────────────────────────

const makeDeployment = (name: string, ready = true): K8sObject => ({
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: {
    name,
    namespace: 'default',
    creationTimestamp: '2024-01-01T00:00:00Z',
  },
  status: {
    conditions: [
      { type: 'Available', status: ready ? 'True' : 'False' },
    ],
  },
})

const makeConfigMap = (name: string): K8sObject => ({
  apiVersion: 'v1',
  kind: 'ConfigMap',
  metadata: {
    name,
    namespace: 'default',
    creationTimestamp: '2024-01-01T00:00:00Z',
  },
  // No status field — stateless resource
})

const makeNamespace = (name: string): K8sObject => ({
  apiVersion: 'v1',
  kind: 'Namespace',
  metadata: {
    name,
    creationTimestamp: '2024-01-01T00:00:00Z',
    // No namespace on cluster-scoped resource
  },
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ResourceGraphPanel', () => {
  it('shows panel heading (O1)', () => {
    render(<ResourceGraphPanel children={[makeDeployment('app')]} />)
    expect(screen.getByText('Resources')).toBeDefined()
  })

  it('shows empty state when children is empty (O5)', () => {
    render(<ResourceGraphPanel children={[]} />)
    expect(screen.getByText(/No managed resources found/)).toBeDefined()
  })

  it('shows loading skeleton when loading and no children (O5)', () => {
    const { container } = render(<ResourceGraphPanel children={null} childrenLoading={true} />)
    const skeletons = container.querySelectorAll('.resource-graph-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('groups resources by kind and shows count badge (O2, O4)', () => {
    const children = [
      makeDeployment('app-1'),
      makeDeployment('app-2'),
      makeConfigMap('config-1'),
    ]
    render(<ResourceGraphPanel children={children} />)

    // Group headers exist
    expect(screen.getAllByText('Deployment').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ConfigMap').length).toBeGreaterThan(0)

    // Count badges
    expect(screen.getByText('2')).toBeDefined()  // Deployment count
    expect(screen.getByText('1')).toBeDefined()  // ConfigMap count
  })

  it('expands/collapses groups on click (O4 interaction)', () => {
    const children = [makeDeployment('app')]
    render(<ResourceGraphPanel children={children} />)

    const header = screen.getByRole('button', { name: /Deployment/i })
    expect(header.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(header)
    expect(header.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('app')).toBeDefined()

    fireEvent.click(header)
    expect(header.getAttribute('aria-expanded')).toBe('false')
  })

  it('shows resource name, namespace, and age when expanded (O3)', () => {
    const children = [makeDeployment('my-app')]
    render(<ResourceGraphPanel children={children} />)

    // Expand
    fireEvent.click(screen.getByRole('button', { name: /Deployment/i }))

    expect(screen.getByText('my-app')).toBeDefined()
    expect(screen.getByText('default')).toBeDefined()
  })

  it('shows cluster-scoped for resources without namespace (O3)', () => {
    const children = [makeNamespace('my-ns')]
    render(<ResourceGraphPanel children={children} />)

    fireEvent.click(screen.getByRole('button', { name: /Namespace/i }))
    expect(screen.getByText('cluster-scoped')).toBeDefined()
  })

  it('shows running status dot for stateless resources like ConfigMap (O3)', () => {
    const children = [makeConfigMap('my-config')]
    render(<ResourceGraphPanel children={children} />)
    fireEvent.click(screen.getByRole('button', { name: /ConfigMap/i }))

    const dots = document.querySelectorAll('.resource-status-dot--running')
    expect(dots.length).toBeGreaterThan(0)
  })

  it('shows failed status dot for unhealthy Deployment (O3)', () => {
    const children = [makeDeployment('bad-app', false)]
    render(<ResourceGraphPanel children={children} />)
    fireEvent.click(screen.getByRole('button', { name: /Deployment/i }))

    const dots = document.querySelectorAll('.resource-status-dot--failed')
    expect(dots.length).toBeGreaterThan(0)
  })

  it('calls onResourceClick with correct info when row clicked (O6)', () => {
    const onClick = vi.fn()
    const children = [makeDeployment('app')]
    render(<ResourceGraphPanel children={children} onResourceClick={onClick} />)

    fireEvent.click(screen.getByRole('button', { name: /Deployment/i }))
    fireEvent.click(screen.getByText('app'))

    expect(onClick).toHaveBeenCalledWith({
      kind: 'Deployment',
      name: 'app',
      namespace: 'default',
      group: 'apps',
      version: 'v1',
    })
  })

  it('rows are not clickable without onResourceClick (O6)', () => {
    const children = [makeDeployment('app')]
    render(<ResourceGraphPanel children={children} />)

    fireEvent.click(screen.getByRole('button', { name: /Deployment/i }))

    const item = screen.getByText('app').closest('.resource-item')
    expect(item?.classList.contains('resource-item--clickable')).toBe(false)
  })
})
