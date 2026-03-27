// TerminatingBanner.test.tsx — unit tests for TerminatingBanner component.
//
// Covers:
//   - Basic rendering with deletionTimestamp
//   - No escalation section when < 5 minutes
//   - Escalation section shown when finalizers present for >= 5 minutes
//   - kubectl patch command correctly constructed

import { render, screen } from '@testing-library/react'
import TerminatingBanner from './TerminatingBanner'

describe('TerminatingBanner', () => {
  const PAST_NOW = new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 min ago
  const PAST_OLD = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min ago

  it('renders the basic terminating banner with relative time', () => {
    render(
      <TerminatingBanner
        deletionTimestamp={PAST_NOW}
        tick={0}
      />
    )
    const banner = screen.getByRole('status')
    expect(banner).toBeInTheDocument()
    expect(banner.textContent).toMatch(/Terminating since/)
  })

  it('does NOT show escalation when no finalizers', () => {
    render(
      <TerminatingBanner
        deletionTimestamp={PAST_OLD}
        tick={0}
        finalizers={[]}
      />
    )
    expect(screen.queryByText(/To force remove/)).not.toBeInTheDocument()
  })

  it('does NOT show escalation when finalizers present but < 5 minutes', () => {
    render(
      <TerminatingBanner
        deletionTimestamp={PAST_NOW}
        tick={0}
        finalizers={['kro.run/finalizer']}
        instanceKind="AutoscaledApp"
        instanceName="my-app"
        instanceNamespace="default"
      />
    )
    expect(screen.queryByText(/To force remove/)).not.toBeInTheDocument()
  })

  it('shows escalation section when finalizers blocked for >= 5 minutes', () => {
    render(
      <TerminatingBanner
        deletionTimestamp={PAST_OLD}
        tick={0}
        finalizers={['kro.run/finalizer']}
        instanceKind="AutoscaledApp"
        instanceName="my-app"
        instanceNamespace="kro-ui-demo"
      />
    )
    // Should show the "To force remove" escalation
    expect(screen.getByText(/To force remove/)).toBeInTheDocument()
  })

  it('includes kubectl patch command with correct kind/name/namespace', () => {
    render(
      <TerminatingBanner
        deletionTimestamp={PAST_OLD}
        tick={0}
        finalizers={['kro.run/finalizer']}
        instanceKind="AutoscaledApp"
        instanceName="autoscaled-proxy"
        instanceNamespace="kro-ui-demo"
      />
    )
    const cmd = document.querySelector('.terminating-banner-cmd')
    expect(cmd?.textContent).toContain('autoscaledapp')
    expect(cmd?.textContent).toContain('autoscaled-proxy')
    expect(cmd?.textContent).toContain('-n kro-ui-demo')
    expect(cmd?.textContent).toContain('--type=json')
  })

  it('omits -n flag for cluster-scoped instances (empty namespace)', () => {
    render(
      <TerminatingBanner
        deletionTimestamp={PAST_OLD}
        tick={0}
        finalizers={['kro.run/finalizer']}
        instanceKind="ClusterApp"
        instanceName="my-cluster-app"
        instanceNamespace=""
      />
    )
    const cmd = document.querySelector('.terminating-banner-cmd')
    expect(cmd?.textContent).not.toContain('-n ')
    expect(cmd?.textContent).toContain('clusterapp')
    expect(cmd?.textContent).toContain('my-cluster-app')
  })

  it('shows "blocked" message but no kubectl command when instanceKind is absent', () => {
    render(
      <TerminatingBanner
        deletionTimestamp={PAST_OLD}
        tick={0}
        finalizers={['kro.run/finalizer']}
        // no instanceKind
        instanceName="my-app"
        instanceNamespace="default"
      />
    )
    // Escalation text shows (blocked Nm) but no kubectl command without kind
    const banner = document.querySelector('.terminating-banner')
    expect(banner?.textContent).toMatch(/blocked/)
    expect(document.querySelector('.terminating-banner-cmd')).not.toBeInTheDocument()
  })
})
