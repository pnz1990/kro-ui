import { render } from '@testing-library/react'
import SkeletonCard from './SkeletonCard'

describe('SkeletonCard', () => {
  it('renders with aria-hidden for accessibility', () => {
    const { container } = render(<SkeletonCard />)
    const root = container.firstElementChild
    expect(root).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders placeholder elements', () => {
    const { container } = render(<SkeletonCard />)
    const lines = container.querySelectorAll('.skeleton-card__line')
    expect(lines.length).toBeGreaterThan(0)
  })
})
