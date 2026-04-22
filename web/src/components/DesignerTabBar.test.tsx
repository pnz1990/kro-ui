// DesignerTabBar.test.tsx — unit tests for the RGD Designer tab bar.
//
// Spec: .specify/specs/issue-684/spec.md O1, O8, O9

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DesignerTabBar from './DesignerTabBar'
import type { DesignerTab } from './DesignerTabBar'

function renderBar(activeTab: DesignerTab = 'schema', onTabChange = vi.fn()) {
  return render(<DesignerTabBar activeTab={activeTab} onTabChange={onTabChange} />)
}

describe('DesignerTabBar', () => {
  // ── Structure ──────────────────────────────────────────────────────────────

  it('renders a tablist with 4 tabs', () => {
    renderBar()
    const list = screen.getByRole('tablist')
    expect(list).toBeInTheDocument()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
  })

  it('renders Schema, Resources, YAML, Preview tabs', () => {
    renderBar()
    expect(screen.getByTestId('designer-tab-schema')).toBeInTheDocument()
    expect(screen.getByTestId('designer-tab-resources')).toBeInTheDocument()
    expect(screen.getByTestId('designer-tab-yaml')).toBeInTheDocument()
    expect(screen.getByTestId('designer-tab-preview')).toBeInTheDocument()
  })

  // ── aria-selected ───────────────────────────────────────────────────────────

  it('sets aria-selected="true" on the active tab', () => {
    renderBar('resources')
    expect(screen.getByTestId('designer-tab-resources')).toHaveAttribute('aria-selected', 'true')
  })

  it('sets aria-selected="false" on inactive tabs', () => {
    renderBar('resources')
    expect(screen.getByTestId('designer-tab-schema')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('designer-tab-yaml')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('designer-tab-preview')).toHaveAttribute('aria-selected', 'false')
  })

  // ── Click interaction ──────────────────────────────────────────────────────

  it('calls onTabChange when a tab is clicked', () => {
    const onTabChange = vi.fn()
    renderBar('schema', onTabChange)
    fireEvent.click(screen.getByTestId('designer-tab-resources'))
    expect(onTabChange).toHaveBeenCalledWith('resources')
  })

  // ── Keyboard navigation ─────────────────────────────────────────────────────

  it('ArrowRight moves focus to next tab', () => {
    renderBar('schema')
    const schemaTab = screen.getByTestId('designer-tab-schema')
    const resourcesTab = screen.getByTestId('designer-tab-resources')
    schemaTab.focus()
    fireEvent.keyDown(schemaTab, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(resourcesTab)
  })

  it('ArrowLeft moves focus to previous tab', () => {
    renderBar('resources')
    const schemaTab = screen.getByTestId('designer-tab-schema')
    const resourcesTab = screen.getByTestId('designer-tab-resources')
    resourcesTab.focus()
    fireEvent.keyDown(resourcesTab, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(schemaTab)
  })

  it('ArrowRight wraps from last tab to first tab', () => {
    renderBar('preview')
    const previewTab = screen.getByTestId('designer-tab-preview')
    const schemaTab = screen.getByTestId('designer-tab-schema')
    previewTab.focus()
    fireEvent.keyDown(previewTab, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(schemaTab)
  })

  it('ArrowLeft wraps from first tab to last tab', () => {
    renderBar('schema')
    const schemaTab = screen.getByTestId('designer-tab-schema')
    const previewTab = screen.getByTestId('designer-tab-preview')
    schemaTab.focus()
    fireEvent.keyDown(schemaTab, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(previewTab)
  })

  it('Enter activates the focused tab', () => {
    const onTabChange = vi.fn()
    renderBar('schema', onTabChange)
    const yamlTab = screen.getByTestId('designer-tab-yaml')
    yamlTab.focus()
    fireEvent.keyDown(yamlTab, { key: 'Enter' })
    expect(onTabChange).toHaveBeenCalledWith('yaml')
  })

  it('Space activates the focused tab', () => {
    const onTabChange = vi.fn()
    renderBar('schema', onTabChange)
    const previewTab = screen.getByTestId('designer-tab-preview')
    previewTab.focus()
    fireEvent.keyDown(previewTab, { key: ' ' })
    expect(onTabChange).toHaveBeenCalledWith('preview')
  })

  // ── tabIndex management ─────────────────────────────────────────────────────

  it('active tab has tabIndex=0, inactive tabs have tabIndex=-1', () => {
    renderBar('yaml')
    expect(screen.getByTestId('designer-tab-yaml')).toHaveAttribute('tabindex', '0')
    expect(screen.getByTestId('designer-tab-schema')).toHaveAttribute('tabindex', '-1')
    expect(screen.getByTestId('designer-tab-resources')).toHaveAttribute('tabindex', '-1')
    expect(screen.getByTestId('designer-tab-preview')).toHaveAttribute('tabindex', '-1')
  })
})
