// Unit tests for OverviewHealthBar aggregation logic (spec 055)

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { aggregateSummaries } from './OverviewHealthBar'
import OverviewHealthBar from './OverviewHealthBar'
import type { HealthSummary } from '@/lib/format'

function makeSummary(overrides: Partial<HealthSummary> = {}): HealthSummary {
  return {
    total: 0,
    ready: 0,
    degraded: 0,
    error: 0,
    reconciling: 0,
    pending: 0,
    unknown: 0,
    ...overrides,
  }
}

describe('aggregateSummaries', () => {
  it('returns all zeros for empty map', () => {
    const result = aggregateSummaries(new Map())
    expect(result).toEqual({ ready: 0, reconciling: 0, degraded: 0, error: 0, pending: 0, noInstances: 0 })
  })

  it('counts RGD with total=0 as noInstances', () => {
    const map = new Map([['cel-functions', makeSummary({ total: 0 })]])
    const result = aggregateSummaries(map)
    expect(result.noInstances).toBe(1)
    expect(result.ready).toBe(0)
  })

  it('aggregates ready instances across multiple RGDs', () => {
    const map = new Map([
      ['test-app', makeSummary({ total: 23, ready: 20, reconciling: 3 })],
      ['multi-resource', makeSummary({ total: 16, ready: 16 })],
    ])
    const result = aggregateSummaries(map)
    expect(result.ready).toBe(36)
    expect(result.reconciling).toBe(3)
    expect(result.noInstances).toBe(0)
  })

  it('aggregates error and degraded counts', () => {
    const map = new Map([
      ['crashloop', makeSummary({ total: 2, error: 2 })],
      ['never-ready', makeSummary({ total: 3, reconciling: 3 })],
      ['inactive', makeSummary({ total: 0 })],
    ])
    const result = aggregateSummaries(map)
    expect(result.error).toBe(2)
    expect(result.reconciling).toBe(3)
    expect(result.ready).toBe(0)
    expect(result.noInstances).toBe(1)
  })

  it('handles mixed fleet with all states', () => {
    const map = new Map([
      ['rgd-a', makeSummary({ total: 10, ready: 5, reconciling: 2, error: 1, degraded: 1, pending: 1 })],
      ['rgd-b', makeSummary({ total: 0 })],
      ['rgd-c', makeSummary({ total: 0 })],
    ])
    const result = aggregateSummaries(map)
    expect(result.ready).toBe(5)
    expect(result.reconciling).toBe(2)
    expect(result.error).toBe(1)
    expect(result.degraded).toBe(1)
    expect(result.pending).toBe(1)
    expect(result.noInstances).toBe(2)
  })
})

describe('OverviewHealthBar — color-blind icons (WCAG 2.1 SC 1.4.1)', () => {
  it('renders an icon prefix on each visible chip', () => {
    const summaries = new Map([
      ['rgd-a', makeSummary({ total: 5, ready: 3, error: 1, reconciling: 1 })],
    ])
    const { container } = render(
      <OverviewHealthBar summaries={summaries} totalRGDs={1} />
    )
    const icons = container.querySelectorAll('.overview-health-bar__chip-icon')
    // ready, error, reconciling → 3 chips, each with an icon
    expect(icons.length).toBeGreaterThanOrEqual(3)
  })

  it('chip icons are aria-hidden', () => {
    const summaries = new Map([
      ['rgd-a', makeSummary({ total: 2, ready: 2 })],
    ])
    const { container } = render(
      <OverviewHealthBar summaries={summaries} totalRGDs={1} />
    )
    const icons = container.querySelectorAll('.overview-health-bar__chip-icon')
    for (const icon of Array.from(icons)) {
      expect(icon.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('ready chip icon is ✓', () => {
    const summaries = new Map([
      ['rgd-a', makeSummary({ total: 2, ready: 2 })],
    ])
    const { container } = render(
      <OverviewHealthBar summaries={summaries} totalRGDs={1} />
    )
    const icons = container.querySelectorAll('.overview-health-bar__chip-icon')
    const texts = Array.from(icons).map((el) => el.textContent)
    expect(texts).toContain('✓')
  })
})

