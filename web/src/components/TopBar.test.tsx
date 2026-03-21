import { render, screen } from '@testing-library/react'
import TopBar from './TopBar'

describe('TopBar', () => {
  it('displays context name', () => {
    render(<TopBar contextName="minikube" />)
    expect(screen.getByTestId('context-name')).toHaveTextContent('minikube')
  })

  it('truncates long context names', () => {
    const longName = 'arn:aws:eks:us-west-2:123456789012:cluster/my-very-long-cluster-name'
    render(<TopBar contextName={longName} />)
    const el = screen.getByTestId('context-name')
    expect(el.textContent).toContain('\u2026')
    expect(el).toHaveAttribute('title', longName)
  })

  it('does not truncate short context names', () => {
    render(<TopBar contextName="minikube" />)
    const el = screen.getByTestId('context-name')
    expect(el.textContent).toBe('minikube')
    expect(el).toHaveAttribute('title', 'minikube')
  })

  it('displays kro-ui branding', () => {
    render(<TopBar contextName="test" />)
    expect(screen.getByText('kro-ui')).toBeInTheDocument()
    expect(screen.getByAltText('kro-ui')).toBeInTheDocument()
  })
})
