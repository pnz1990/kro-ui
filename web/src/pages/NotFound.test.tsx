// NotFound.test.tsx — unit tests for the 404 Not Found page.
//
// Issue #219: NotFound page had no unit test.
// Simple page — covers title, heading, URL display, and home link.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotFound from './NotFound'

function renderPage(path = '/some/unknown/path') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NotFound />
    </MemoryRouter>,
  )
}

describe('NotFound', () => {
  it('sets document.title to "Not Found — kro-ui"', () => {
    renderPage()
    expect(document.title).toBe('Not Found — kro-ui')
  })

  it('renders the "Page not found" heading', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument()
  })

  it('displays the requested URL path', () => {
    renderPage('/some/unknown/path')
    expect(screen.getByTestId('not-found-url')).toHaveTextContent('/some/unknown/path')
  })

  it('renders a link back to Overview (/)', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /back to overview/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })

  it('renders the root testid', () => {
    renderPage()
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument()
  })
})
