// AuthorPage.test.tsx — unit tests for the RGD Designer page.
//
// Issue #219: AuthorPage had no unit test.
// Covers: renders form and preview panes, page title, live DAG hint.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuthorPage from './AuthorPage'

// AuthorPage makes no API calls — no mocking needed.

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthorPage />
    </MemoryRouter>,
  )
}

describe('AuthorPage', () => {
  // ── Page title ─────────────────────────────────────────────────────────

  it('sets document.title to "RGD Designer — kro-ui"', () => {
    renderPage()
    expect(document.title).toBe('RGD Designer — kro-ui')
  })

  // ── Structure ─────────────────────────────────────────────────────────

  it('renders the "RGD Designer" heading', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /rgd designer/i })).toBeInTheDocument()
  })

  it('renders the authoring form', () => {
    renderPage()
    // RGDAuthoringForm renders the schema Kind input — use getAllByRole since there
    // are multiple kind-related inputs (schema kind + resource kind fields)
    const kindInputs = screen.getAllByRole('textbox', { name: /kind/i })
    expect(kindInputs.length).toBeGreaterThanOrEqual(1)
  })

  it('renders the DAG preview SVG pane', () => {
    renderPage()
    // StaticChainDAG renders a dag-svg element
    expect(screen.getByTestId('dag-svg')).toBeInTheDocument()
  })

  it('renders the YAML preview pane', () => {
    renderPage()
    // YAMLPreview renders a code block or pre element with RGD YAML
    const preEl = document.querySelector('pre, code, [data-testid="yaml-preview"]')
    expect(preEl).toBeInTheDocument()
  })

  it('renders the form body area containing both panes', () => {
    const { container } = renderPage()
    // Both form and right panes exist
    expect(container.querySelector('.author-page__form-pane')).toBeInTheDocument()
    expect(container.querySelector('.author-page__right-pane')).toBeInTheDocument()
  })
})
