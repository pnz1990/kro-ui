import { render, screen, waitFor } from '@testing-library/react'
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

  it('shows SA not found note when serviceAccountFound is false', async () => {
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
})
