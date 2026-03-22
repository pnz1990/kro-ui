// ValidationTab.test.tsx — Unit tests for ValidationTab, ConditionItem, ResourceSummary.
//
// Spec: .specify/specs/017-rgd-validation-linting/ (Testing Requirements)

import { render, screen, fireEvent } from '@testing-library/react'
import ValidationTab from './ValidationTab'

// ── Test fixtures ──────────────────────────────────────────────────────────

/** Build a minimal RGD object with given conditions. */
function makeRGD(
  conditions: Array<{
    type: string
    status: string
    reason?: string
    message?: string
    lastTransitionTime?: string
  }>,
  resources: unknown[] = [],
) {
  return {
    apiVersion: 'kro.run/v1alpha1',
    kind: 'ResourceGraphDefinition',
    metadata: { name: 'test-app' },
    spec: {
      schema: { kind: 'WebApp', apiVersion: 'v1alpha1', group: 'test.dev' },
      resources,
    },
    status: { conditions },
  }
}

/** Standard "all passing" condition set. */
const allTrueConditions = [
  { type: 'GraphVerified',                  status: 'True',  reason: 'GraphVerified',    message: '' },
  { type: 'TopologyReady',                  status: 'True',  reason: 'TopologyReady',    message: '' },
  { type: 'CustomResourceDefinitionSynced', status: 'True',  reason: 'CRDSynced',        message: '' },
  { type: 'Ready',                          status: 'True',  reason: 'Ready',            message: '' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function renderValidationTab(rgd: ReturnType<typeof makeRGD>) {
  return render(<ValidationTab rgd={rgd} />)
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ValidationTab', () => {

  // ── SC-001 / FR-002: Green checkmarks for True conditions ──────────────

  it('shows green checkmark (✓) and "Passed" for True conditions', () => {
    renderValidationTab(makeRGD(allTrueConditions))

    // All four known condition items should be rendered
    const graphItem = screen.getByTestId('condition-item-GraphVerified')
    expect(graphItem).toBeInTheDocument()
    expect(graphItem).toHaveClass('condition-item--true')
    expect(graphItem).toHaveTextContent('✓')
    expect(graphItem).toHaveTextContent('Passed')

    const readyItem = screen.getByTestId('condition-item-Ready')
    expect(readyItem).toHaveClass('condition-item--true')
    expect(readyItem).toHaveTextContent('✓')
  })

  // ── SC-002 / FR-002: Red X for False conditions with error message ──────

  it('shows red X (✗) and reason/message for False conditions', () => {
    const rgd = makeRGD([
      {
        type: 'GraphVerified',
        status: 'False',
        reason: 'CycleDetected',
        message: 'cycle detected: A → B → A',
      },
    ])
    renderValidationTab(rgd)

    const item = screen.getByTestId('condition-item-GraphVerified')
    expect(item).toHaveClass('condition-item--false')
    expect(item).toHaveTextContent('✗')
    expect(item).toHaveTextContent('Failed')
    expect(item).toHaveTextContent('CycleDetected')
    expect(item).toHaveTextContent('cycle detected: A → B → A')
  })

  // ── FR-002: Gray pending indicator for absent conditions ────────────────

  it('shows gray pending (○) for absent conditions', () => {
    // RGD with NO conditions — all four known types should show as Pending
    renderValidationTab(makeRGD([]))

    for (const type of ['GraphVerified', 'TopologyReady', 'CustomResourceDefinitionSynced', 'Ready']) {
      const item = screen.getByTestId(`condition-item-${type}`)
      expect(item).toHaveClass('condition-item--pending')
      expect(item).toHaveTextContent('○')
      expect(item).toHaveTextContent('Pending')
    }
  })

  // ── FR-003: Unknown condition types rendered generically ────────────────

  it('renders unknown condition types generically without crashing', () => {
    const rgd = makeRGD([
      ...allTrueConditions,
      {
        type: 'FutureConditionType',
        status: 'False',
        reason: 'SomeReason',
        message: 'Some future validation failed',
      },
    ])
    renderValidationTab(rgd)

    // The unknown type should render — type name used as label
    const unknownItem = screen.getByTestId('condition-item-FutureConditionType')
    expect(unknownItem).toBeInTheDocument()
    expect(unknownItem).toHaveTextContent('FutureConditionType')
    expect(unknownItem).toHaveTextContent('Failed')
    expect(unknownItem).toHaveTextContent('Some future validation failed')
  })

  // ── FR-004 / SC-003: Resource summary with correct type breakdown ────────

  it('shows resource summary with correct type breakdown', () => {
    const resources = [
      {
        id: 'appNamespace',
        template: { apiVersion: 'v1', kind: 'Namespace', metadata: { name: '${schema.spec.appName}' } },
      },
      {
        id: 'appDeployment',
        template: { apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name: '${schema.spec.appName}' } },
      },
      {
        id: 'appService',
        template: { apiVersion: 'v1', kind: 'Service', metadata: { name: '${schema.spec.appName}' } },
      },
      {
        id: 'regionalDeployments',
        template: { apiVersion: 'apps/v1', kind: 'Deployment' },
        forEach: '${schema.spec.regions}',
      },
      {
        id: 'existingCM',
        externalRef: {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: 'my-config' },
        },
      },
    ]
    renderValidationTab(makeRGD(allTrueConditions, resources))

    const summary = screen.getByTestId('resource-summary')
    expect(summary).toBeInTheDocument()
    // 5 resources total: 3 managed, 1 collection, 1 external ref
    expect(summary).toHaveTextContent('5 resources')
    expect(summary).toHaveTextContent('3 managed')
    expect(summary).toHaveTextContent('1 collection')
    expect(summary).toHaveTextContent('1 external ref')
  })

  // ── Edge case: long message truncation with "Show more" toggle ───────────

  it('truncates long messages and shows a "Show more" toggle', () => {
    const longMessage = 'x'.repeat(300)
    const rgd = makeRGD([
      { type: 'GraphVerified', status: 'False', reason: 'SomeError', message: longMessage },
    ])
    renderValidationTab(rgd)

    // The full message should not be visible initially
    expect(screen.queryByText(longMessage)).not.toBeInTheDocument()
    // But the truncated version should be
    expect(screen.getByText(longMessage.slice(0, 200) + '…')).toBeInTheDocument()

    // Toggle "Show more"
    const toggle = screen.getByRole('button', { name: 'Show more' })
    fireEvent.click(toggle)

    // Full message is now visible
    expect(screen.getByText(longMessage)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument()
  })

  // ── FR-006: ?tab=validation tab renders the component ───────────────────
  // This is tested at the RGDDetail level in RGDDetail.test.tsx (added separately).
  // Here we just verify ValidationTab renders when conditions are empty and spec is present.

  it('renders validation tab container with data-testid', () => {
    renderValidationTab(makeRGD([]))
    expect(screen.getByTestId('validation-tab')).toBeInTheDocument()
  })
})
