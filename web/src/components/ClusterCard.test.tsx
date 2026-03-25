import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ClusterCard from './ClusterCard'
import type { ClusterSummary } from '@/lib/api'

function renderCard(summary: ClusterSummary, onSwitch = vi.fn()) {
  return render(
    <MemoryRouter>
      <ClusterCard summary={summary} onSwitch={onSwitch} />
    </MemoryRouter>,
  )
}

describe('ClusterCard', () => {
  it('shows green health for all-healthy cluster', () => {
    const summary: ClusterSummary = {
      context: 'prod',
      cluster: 'prod-cluster',
      health: 'healthy',
      rgdCount: 5,
      instanceCount: 12,
      degradedInstances: 0,
      kroVersion: 'v0.3.1',
      rgdKinds: ['WebApp', 'Database'],
    }
    const { container } = renderCard(summary)
    const dot = container.querySelector('.cluster-card__health-dot')
    expect(dot).toHaveClass('cluster-card__health-dot--healthy')
    expect(screen.getByText('5 RGDs')).toBeInTheDocument()
    expect(screen.getByText('12 instances')).toBeInTheDocument()
  })

  it('shows amber health for degraded cluster', () => {
    const summary: ClusterSummary = {
      context: 'staging',
      cluster: 'staging-cluster',
      health: 'degraded',
      rgdCount: 3,
      instanceCount: 7,
      degradedInstances: 2,
      kroVersion: 'v0.3.0',
      rgdKinds: ['WebApp'],
    }
    const { container } = renderCard(summary)
    const dot = container.querySelector('.cluster-card__health-dot')
    expect(dot).toHaveClass('cluster-card__health-dot--degraded')
    expect(screen.getAllByText('2 degraded').length).toBeGreaterThanOrEqual(1)
  })

  it('shows gray health for unreachable cluster', () => {
    const summary: ClusterSummary = {
      context: 'dev',
      cluster: 'dev-cluster',
      health: 'unreachable',
      rgdCount: 0,
      instanceCount: 0,
      degradedInstances: 0,
      kroVersion: '',
      rgdKinds: [],
      error: 'connection refused',
    }
    const { container } = renderCard(summary)
    const dot = container.querySelector('.cluster-card__health-dot')
    expect(dot).toHaveClass('cluster-card__health-dot--unreachable')
    expect(screen.getAllByText('Unreachable').length).toBeGreaterThanOrEqual(1)
  })

  it('calls onSwitch with context name when clicked', () => {
    const onSwitch = vi.fn()
    const summary: ClusterSummary = {
      context: 'prod',
      cluster: 'prod-cluster',
      health: 'healthy',
      rgdCount: 1,
      instanceCount: 2,
      degradedInstances: 0,
      kroVersion: 'v0.3.1',
      rgdKinds: [],
    }
    renderCard(summary, onSwitch)
    fireEvent.click(screen.getByRole('button'))
    expect(onSwitch).toHaveBeenCalledWith('prod')
  })

  it('shows kro-not-installed status correctly', () => {
    const summary: ClusterSummary = {
      context: 'empty',
      cluster: 'empty-cluster',
      health: 'kro-not-installed',
      rgdCount: 0,
      instanceCount: 0,
      degradedInstances: 0,
      kroVersion: '',
      rgdKinds: [],
    }
    renderCard(summary)
    expect(screen.getAllByText('kro not installed').length).toBeGreaterThanOrEqual(1)
  })
})
