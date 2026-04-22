// DesignerShareButton.test.tsx — Unit tests for the Designer share button.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import DesignerShareButton from './DesignerShareButton'
import type { RGDAuthoringState } from '@/lib/generator'

function makeState(): RGDAuthoringState {
  return {
    rgdName: 'my-app',
    kind: 'MyApp',
    group: 'kro.run',
    apiVersion: 'v1alpha1',
    scope: 'Namespaced',
    specFields: [],
    statusFields: [],
    resources: [],
  }
}

describe('DesignerShareButton', () => {
  beforeEach(() => {
    // Mock window.location so buildShareUrl works
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:40107/author',
        search: '',
        hash: '',
        origin: 'http://localhost:40107',
        pathname: '/author',
        protocol: 'http:',
        host: 'localhost:40107',
      },
      writable: true,
    })
  })

  it('renders with label "Share"', () => {
    render(<DesignerShareButton state={makeState()} />)
    expect(screen.getByTestId('designer-share-btn')).toBeInTheDocument()
    expect(screen.getByText('Share')).toBeInTheDocument()
  })

  it('has correct aria-label', () => {
    render(<DesignerShareButton state={makeState()} />)
    const btn = screen.getByTestId('designer-share-btn')
    expect(btn).toHaveAttribute('aria-label', 'Copy shareable Designer URL to clipboard')
  })

  it('shows "Copied!" after successful clipboard write', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    render(<DesignerShareButton state={makeState()} />)
    const btn = screen.getByTestId('designer-share-btn')
    await act(async () => { fireEvent.click(btn) })
    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })

  it('shows "Error" if clipboard write fails', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    // Also make execCommand fail
    Object.defineProperty(document, 'execCommand', {
      value: () => { throw new Error('not supported') },
      writable: true,
    })
    render(<DesignerShareButton state={makeState()} />)
    const btn = screen.getByTestId('designer-share-btn')
    await act(async () => { fireEvent.click(btn) })
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('resets to "Share" after 2s', async () => {
    vi.useFakeTimers()
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    render(<DesignerShareButton state={makeState()} />)
    const btn = screen.getByTestId('designer-share-btn')
    await act(async () => { fireEvent.click(btn) })
    expect(screen.getByText('Copied!')).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(screen.getByText('Share')).toBeInTheDocument()
    vi.useRealTimers()
  })
})
