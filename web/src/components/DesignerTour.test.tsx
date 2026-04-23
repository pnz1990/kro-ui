// DesignerTour.test.tsx — Unit tests for the Designer onboarding guided tour.
//
// Spec: issue-766 O1–O8
// Design ref: docs/design/31-rgd-designer.md §Future 31.1

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DesignerTour, { TOUR_KEY } from './DesignerTour'

// createPortal renders in document.body in jsdom — no stub needed.

describe('DesignerTour', () => {
  const defaultProps = {
    step: 0,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onDismiss: vi.fn(),
  }

  afterEach(() => {
    localStorage.clear()
  })

  it('renders the tour overlay (O1)', () => {
    render(<DesignerTour {...defaultProps} />)
    expect(screen.getByTestId('designer-tour-overlay')).toBeInTheDocument()
  })

  it('has role=dialog with correct aria-label (O7)', () => {
    render(<DesignerTour {...defaultProps} />)
    expect(
      screen.getByRole('dialog', { name: /designer guided tour/i }),
    ).toBeInTheDocument()
  })

  it('shows step 1 of 4 on first step (O2)', () => {
    render(<DesignerTour {...defaultProps} />)
    expect(screen.getByText('1 of 4')).toBeInTheDocument()
    expect(screen.getByText(/schema field editor/i)).toBeInTheDocument()
  })

  it('shows step 2 of 4 on second step (O2)', () => {
    render(<DesignerTour {...defaultProps} step={1} />)
    expect(screen.getByText('2 of 4')).toBeInTheDocument()
    expect(screen.getByText(/resource node types/i)).toBeInTheDocument()
  })

  it('shows step 3 of 4 on third step (O2)', () => {
    render(<DesignerTour {...defaultProps} step={2} />)
    expect(screen.getByText('3 of 4')).toBeInTheDocument()
    expect(screen.getByText(/yaml preview/i)).toBeInTheDocument()
  })

  it('shows step 4 of 4 on last step (O2)', () => {
    render(<DesignerTour {...defaultProps} step={3} />)
    expect(screen.getByText('4 of 4')).toBeInTheDocument()
    expect(screen.getByText(/apply to cluster/i)).toBeInTheDocument()
  })

  it('calls onNext when Next clicked (O2)', () => {
    const onNext = vi.fn()
    render(<DesignerTour {...defaultProps} onNext={onNext} />)
    fireEvent.click(screen.getByTestId('tour-next-btn'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when Finish clicked on last step (O4)', () => {
    const onDismiss = vi.fn()
    render(<DesignerTour {...defaultProps} step={3} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByTestId('tour-finish-btn'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when Skip tour clicked (O3)', () => {
    const onDismiss = vi.fn()
    render(<DesignerTour {...defaultProps} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByTestId('tour-skip-btn'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not show Back button on first step', () => {
    render(<DesignerTour {...defaultProps} step={0} />)
    expect(screen.queryByTestId('tour-back-btn')).not.toBeInTheDocument()
  })

  it('shows Back button on steps > 0', () => {
    render(<DesignerTour {...defaultProps} step={1} />)
    expect(screen.getByTestId('tour-back-btn')).toBeInTheDocument()
  })

  it('calls onBack when Back clicked', () => {
    const onBack = vi.fn()
    render(<DesignerTour {...defaultProps} step={1} onBack={onBack} />)
    fireEvent.click(screen.getByTestId('tour-back-btn'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('shows "Next" on non-last steps and "Finish" on last step', () => {
    const { rerender } = render(<DesignerTour {...defaultProps} step={0} />)
    expect(screen.getByTestId('tour-next-btn')).toHaveTextContent('Next')
    rerender(<DesignerTour {...defaultProps} step={3} />)
    expect(screen.getByTestId('tour-finish-btn')).toHaveTextContent('Finish')
  })

  it('dismisses on Escape key (O3)', () => {
    const onDismiss = vi.fn()
    render(<DesignerTour {...defaultProps} onDismiss={onDismiss} />)
    const card = screen.getByTestId('designer-tour-card')
    fireEvent.keyDown(card, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('exports TOUR_KEY constant', () => {
    expect(TOUR_KEY).toBe('kro-ui-designer-toured')
  })
})
