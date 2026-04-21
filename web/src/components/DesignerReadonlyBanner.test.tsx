// DesignerReadonlyBanner.test.tsx — Unit tests for the Designer readonly banner.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DesignerReadonlyBanner from './DesignerReadonlyBanner'

describe('DesignerReadonlyBanner', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:40107/author?share=abc123',
        search: '?share=abc123',
        pathname: '/author',
      },
      writable: true,
    })
    Object.defineProperty(window, 'history', {
      value: { replaceState: vi.fn() },
      writable: true,
    })
  })

  it('renders the readonly banner', () => {
    render(<DesignerReadonlyBanner onEdit={vi.fn()} />)
    expect(screen.getByTestId('designer-readonly-banner')).toBeInTheDocument()
  })

  it('shows the readonly text', () => {
    render(<DesignerReadonlyBanner onEdit={vi.fn()} />)
    expect(screen.getByText(/read-only shared view/i)).toBeInTheDocument()
  })

  it('shows Edit a copy button', () => {
    render(<DesignerReadonlyBanner onEdit={vi.fn()} />)
    expect(screen.getByTestId('designer-readonly-edit-btn')).toBeInTheDocument()
    expect(screen.getByText('Edit a copy')).toBeInTheDocument()
  })

  it('calls onEdit when Edit a copy clicked', () => {
    const onEdit = vi.fn()
    render(<DesignerReadonlyBanner onEdit={onEdit} />)
    fireEvent.click(screen.getByTestId('designer-readonly-edit-btn'))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('removes ?share= from URL when Edit a copy clicked', () => {
    const onEdit = vi.fn()
    render(<DesignerReadonlyBanner onEdit={onEdit} />)
    fireEvent.click(screen.getByTestId('designer-readonly-edit-btn'))
    expect(window.history.replaceState).toHaveBeenCalled()
  })

  it('has role=status', () => {
    render(<DesignerReadonlyBanner onEdit={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
