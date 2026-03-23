import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import AccessTab from './AccessTab'
import type { AccessResponse } from '@/lib/api'

// Mock the API module so tests don't make real HTTP calls
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, getRGDAccess: vi.fn() }
})

// Mock KroCodeBlock to avoid the useCapabilities hook (which calls fetch internally)
vi.mock('@/components/KroCodeBlock', () => ({
  default: ({ code, title }: { code: string; title?: string }) => (
    <pre data-testid="kro-code-block" data-title={title}>{code}</pre>
  ),
}))

import { getRGDAccess } from '@/lib/api'
const mockGetRGDAccess = getRGDAccess as ReturnType<typeof vi.fn>

/** Build a permission row fixture. */
function makePermission(
  group: string,
  resource: string,
  kind: string,
  grantedVerbs: string[],
  readOnly = false,
) {
  const required = readOnly
    ? ['get', 'list', 'watch']
    : ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete']
  const granted: Record<string, boolean> = {}
  for (const v of required) {
    granted[v] = grantedVerbs.includes(v)
  }
  return { group, version: 'v1', resource, kind, required, granted }
}

/** Build a full AccessResponse. */
function makeAccessResponse(overrides: Partial<AccessResponse> = {}): AccessResponse {
  return {
    serviceAccount: 'kro-system/kro',
    serviceAccountFound: true,
    clusterRole: 'kro-manager-role',
    hasGaps: false,
    permissions: [],
    ...overrides,
  }
}

describe('AccessTab', () => {
  beforeEach(() => {
    mockGetRGDAccess.mockReset()
  })

  it('shows loading state initially', () => {
    // Never resolves — stays in loading state
    mockGetRGDAccess.mockReturnValue(new Promise(() => {}))
    render(<AccessTab rgdName="test-app" />)
    expect(screen.getByText(/Checking permissions/i)).toBeInTheDocument()
  })

  it('shows green success banner when all permissions satisfied', async () => {
    const resp = makeAccessResponse({
      hasGaps: false,
      permissions: [
        makePermission('apps', 'deployments', 'Deployment', [
          'get', 'list', 'watch', 'create', 'update', 'patch', 'delete',
        ]),
      ],
    })
    mockGetRGDAccess.mockResolvedValue(resp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() => {
      expect(screen.getByTestId('access-tab-success-banner')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('access-tab-warning-banner')).not.toBeInTheDocument()
  })

  it('shows red warning banner when gaps exist', async () => {
    const resp = makeAccessResponse({
      hasGaps: true,
      permissions: [
        makePermission('iam.amazonaws.com', 'iamroles', 'IAMRole', []),
      ],
    })
    mockGetRGDAccess.mockResolvedValue(resp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() => {
      expect(screen.getByTestId('access-tab-warning-banner')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('access-tab-success-banner')).not.toBeInTheDocument()
  })

  it('shows green ✓ for granted permissions', async () => {
    const resp = makeAccessResponse({
      hasGaps: false,
      permissions: [
        makePermission('apps', 'deployments', 'Deployment', [
          'get', 'list', 'watch', 'create', 'update', 'patch', 'delete',
        ]),
      ],
    })
    mockGetRGDAccess.mockResolvedValue(resp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab')).toBeInTheDocument(),
    )

    // All perm-cell--granted cells should contain ✓
    const grantedCells = document.querySelectorAll('.perm-cell--granted')
    expect(grantedCells.length).toBe(7) // 7 verbs all granted
    grantedCells.forEach((cell) => {
      expect(cell.textContent).toContain('✓')
    })
  })

  it('shows red ✗ for missing permissions', async () => {
    const resp = makeAccessResponse({
      hasGaps: true,
      permissions: [
        makePermission('iam.amazonaws.com', 'iamroles', 'IAMRole', []),
      ],
    })
    mockGetRGDAccess.mockResolvedValue(resp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab')).toBeInTheDocument(),
    )

    const deniedCells = document.querySelectorAll('.perm-cell--denied')
    expect(deniedCells.length).toBe(7) // all 7 verbs denied
    deniedCells.forEach((cell) => {
      expect(cell.textContent).toContain('✗')
    })
  })

  it('shows SA not found note when serviceAccountFound is false but serviceAccount is non-empty', async () => {
    const resp = makeAccessResponse({
      serviceAccountFound: false,
      serviceAccount: 'kro-system/kro',
    })
    mockGetRGDAccess.mockResolvedValue(resp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab-sa-banner')).toBeInTheDocument(),
    )
    expect(screen.getByText(/could not verify service account/i)).toBeInTheDocument()
  })

  it('shows fix suggestions when gaps exist', async () => {
    const resp = makeAccessResponse({
      hasGaps: true,
      permissions: [
        makePermission('', 'configmaps', 'ConfigMap', ['get', 'list', 'watch']),
      ],
    })
    mockGetRGDAccess.mockResolvedValue(resp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab-fixes')).toBeInTheDocument(),
    )
  })

  it('shows error state and retry button on fetch failure', async () => {
    mockGetRGDAccess.mockRejectedValue(new Error('cluster unreachable'))

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab-error')).toBeInTheDocument(),
    )
    expect(screen.getByText(/cluster unreachable/i)).toBeInTheDocument()
    expect(screen.getByText(/Retry/i)).toBeInTheDocument()
  })

  // ── US1: Manual override form when SA not found ─────────────────────────

  it('shows manual override form when serviceAccount is empty and serviceAccountFound is false', async () => {
    const resp = makeAccessResponse({
      serviceAccount: '',
      serviceAccountFound: false,
      permissions: [],
      hasGaps: false,
    })
    mockGetRGDAccess.mockResolvedValue(resp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab-sa-override-form')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('access-tab-sa-ns-input')).toBeInTheDocument()
    expect(screen.getByTestId('access-tab-sa-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('access-tab-sa-override-submit')).toBeInTheDocument()
  })

  it('submit button is disabled when inputs are empty', async () => {
    const resp = makeAccessResponse({
      serviceAccount: '',
      serviceAccountFound: false,
      permissions: [],
      hasGaps: false,
    })
    mockGetRGDAccess.mockResolvedValue(resp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab-sa-override-submit')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('access-tab-sa-override-submit')).toBeDisabled()
  })

  it('submit button is enabled when both inputs have values', async () => {
    const resp = makeAccessResponse({
      serviceAccount: '',
      serviceAccountFound: false,
      permissions: [],
      hasGaps: false,
    })
    mockGetRGDAccess.mockResolvedValue(resp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab-sa-ns-input')).toBeInTheDocument(),
    )

    fireEvent.change(screen.getByTestId('access-tab-sa-ns-input'), {
      target: { value: 'kro-prod' },
    })
    fireEvent.change(screen.getByTestId('access-tab-sa-name-input'), {
      target: { value: 'kro-operator' },
    })

    expect(screen.getByTestId('access-tab-sa-override-submit')).not.toBeDisabled()
  })

  // ── US2: Manual form submit re-fetches with query params ────────────────

  it('re-fetches with saNamespace and saName query params on manual form submit', async () => {
    const emptyResp = makeAccessResponse({
      serviceAccount: '',
      serviceAccountFound: false,
      permissions: [],
      hasGaps: false,
    })
    const overrideResp = makeAccessResponse({
      serviceAccount: 'kro-prod/kro-operator',
      serviceAccountFound: true,
      permissions: [],
      hasGaps: false,
    })
    // First call returns empty SA, second (override) returns real SA
    mockGetRGDAccess.mockResolvedValueOnce(emptyResp).mockResolvedValueOnce(overrideResp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab-sa-ns-input')).toBeInTheDocument(),
    )

    fireEvent.change(screen.getByTestId('access-tab-sa-ns-input'), {
      target: { value: 'kro-prod' },
    })
    fireEvent.change(screen.getByTestId('access-tab-sa-name-input'), {
      target: { value: 'kro-operator' },
    })
    fireEvent.click(screen.getByTestId('access-tab-sa-override-submit'))

    await waitFor(() =>
      expect(mockGetRGDAccess).toHaveBeenCalledWith('test-app', {
        saNamespace: 'kro-prod',
        saName: 'kro-operator',
      }),
    )
  })

  it('shows permission matrix after successful manual override', async () => {
    const emptyResp = makeAccessResponse({
      serviceAccount: '',
      serviceAccountFound: false,
      permissions: [],
      hasGaps: false,
    })
    const overrideResp = makeAccessResponse({
      serviceAccount: 'kro-prod/kro-operator',
      serviceAccountFound: true,
      permissions: [
        makePermission('apps', 'deployments', 'Deployment', [
          'get', 'list', 'watch', 'create', 'update', 'patch', 'delete',
        ]),
      ],
      hasGaps: false,
    })
    mockGetRGDAccess.mockResolvedValueOnce(emptyResp).mockResolvedValueOnce(overrideResp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab-sa-ns-input')).toBeInTheDocument(),
    )

    fireEvent.change(screen.getByTestId('access-tab-sa-ns-input'), {
      target: { value: 'kro-prod' },
    })
    fireEvent.change(screen.getByTestId('access-tab-sa-name-input'), {
      target: { value: 'kro-operator' },
    })
    fireEvent.click(screen.getByTestId('access-tab-sa-override-submit'))

    // After override, the permission matrix should show (no more override form)
    await waitFor(() =>
      expect(screen.queryByTestId('access-tab-sa-override-form')).not.toBeInTheDocument(),
    )
    expect(screen.getByTestId('access-tab-success-banner')).toBeInTheDocument()
  })

  it('shows (manually specified) badge after manual override', async () => {
    const emptyResp = makeAccessResponse({
      serviceAccount: '',
      serviceAccountFound: false,
      permissions: [],
      hasGaps: false,
    })
    const overrideResp = makeAccessResponse({
      serviceAccount: 'kro-prod/kro-operator',
      serviceAccountFound: true,
      permissions: [],
      hasGaps: false,
    })
    mockGetRGDAccess.mockResolvedValueOnce(emptyResp).mockResolvedValueOnce(overrideResp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab-sa-ns-input')).toBeInTheDocument(),
    )

    fireEvent.change(screen.getByTestId('access-tab-sa-ns-input'), {
      target: { value: 'kro-prod' },
    })
    fireEvent.change(screen.getByTestId('access-tab-sa-name-input'), {
      target: { value: 'kro-operator' },
    })
    fireEvent.click(screen.getByTestId('access-tab-sa-override-submit'))

    await waitFor(() =>
      expect(screen.getByText(/manually specified/i)).toBeInTheDocument(),
    )
  })

  // ── US3: Human-readable SA banner ──────────────────────────────────────

  it('shows labeled namespace and service account name not raw slash format', async () => {
    const resp = makeAccessResponse({
      serviceAccount: 'kro-system/kro',
      serviceAccountFound: true,
    })
    mockGetRGDAccess.mockResolvedValue(resp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab-sa-banner')).toBeInTheDocument(),
    )

    // Should show "Namespace:" and "Service account:" labels
    expect(screen.getByText('Namespace:')).toBeInTheDocument()
    expect(screen.getByText('Service account:')).toBeInTheDocument()
    expect(screen.getByTestId('access-tab-sa-namespace')).toHaveTextContent('kro-system')
    expect(screen.getByTestId('access-tab-sa-name')).toHaveTextContent('kro')

    // Raw "kro-system/kro" slash string should NOT appear as a single text node
    expect(screen.queryByText('kro-system/kro')).not.toBeInTheDocument()
  })

  it('shows (auto-detected) indicator when serviceAccountFound is true', async () => {
    const resp = makeAccessResponse({
      serviceAccount: 'kro-system/kro',
      serviceAccountFound: true,
    })
    mockGetRGDAccess.mockResolvedValue(resp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab-sa-banner')).toBeInTheDocument(),
    )
    expect(screen.getByText(/auto-detected/i)).toBeInTheDocument()
  })

  it('banner has title attribute with full namespace/name for accessibility', async () => {
    const resp = makeAccessResponse({
      serviceAccount: 'kro-system/kro',
      serviceAccountFound: true,
    })
    mockGetRGDAccess.mockResolvedValue(resp)

    render(<AccessTab rgdName="test-app" />)
    await waitFor(() =>
      expect(screen.getByTestId('access-tab-sa-banner')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('access-tab-sa-banner')).toHaveAttribute(
      'title',
      'kro-system/kro',
    )
  })
})
