import {
  formatAge,
  extractReadyStatus,
  extractRGDName,
  extractRGDKind,
  extractResourceCount,
  readyStateColor,
  readyStateLabel,
  extractInstanceHealth,
  aggregateHealth,
  abbreviateContext,
  displayNamespace,
} from './format'

// ── formatAge ────────────────────────────────────────────────────────

describe('formatAge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns Unknown for empty string', () => {
    expect(formatAge('')).toBe('Unknown')
  })

  it('returns Unknown for invalid date string', () => {
    expect(formatAge('not-a-date')).toBe('Unknown')
  })

  it('returns "just now" for future timestamp (clock skew)', () => {
    expect(formatAge('2026-03-20T13:00:00Z')).toBe('just now')
  })

  it('returns "just now" for 0s elapsed (exact match)', () => {
    expect(formatAge('2026-03-20T12:00:00Z')).toBe('just now')
  })

  it('returns "just now" for 4s elapsed (below 5s threshold)', () => {
    // 4 seconds before the fake "now" of 12:00:00
    expect(formatAge('2026-03-20T11:59:56Z')).toBe('just now')
  })

  it('returns seconds for 5s elapsed (at threshold boundary)', () => {
    expect(formatAge('2026-03-20T11:59:55Z')).toBe('5s')
  })

  it('returns seconds for <1 minute elapsed', () => {
    expect(formatAge('2026-03-20T11:59:30Z')).toBe('30s')
  })

  it('returns minutes for <1 hour elapsed', () => {
    expect(formatAge('2026-03-20T11:55:00Z')).toBe('5m')
  })

  it('returns hours for <1 day elapsed', () => {
    expect(formatAge('2026-03-20T10:00:00Z')).toBe('2h')
  })

  it('returns days for >=1 day elapsed', () => {
    expect(formatAge('2026-03-17T12:00:00Z')).toBe('3d')
  })
})

// ── extractReadyStatus ───────────────────────────────────────────────

describe('extractReadyStatus', () => {
  it('returns ready when Ready=True condition exists', () => {
    const obj = {
      status: {
        conditions: [{ type: 'Ready', status: 'True' }],
      },
    }
    expect(extractReadyStatus(obj).state).toBe('ready')
  })

  it('returns error when Ready=False condition exists', () => {
    const obj = {
      status: {
        conditions: [{ type: 'Ready', status: 'False' }],
      },
    }
    expect(extractReadyStatus(obj).state).toBe('error')
  })

  it('returns unknown when Ready=Unknown condition exists', () => {
    const obj = {
      status: {
        conditions: [{ type: 'Ready', status: 'Unknown' }],
      },
    }
    expect(extractReadyStatus(obj).state).toBe('unknown')
  })

  it('returns unknown when no Ready condition in array', () => {
    const obj = {
      status: {
        conditions: [{ type: 'Progressing', status: 'True' }],
      },
    }
    expect(extractReadyStatus(obj).state).toBe('unknown')
  })

  it('returns unknown when conditions is not an array', () => {
    const obj = { status: { conditions: 'not-array' } }
    expect(extractReadyStatus(obj).state).toBe('unknown')
  })

  it('returns unknown when status field is missing', () => {
    expect(extractReadyStatus({}).state).toBe('unknown')
  })

  it('returns unknown for empty object', () => {
    expect(extractReadyStatus({}).state).toBe('unknown')
  })

  it('includes reason and message when present', () => {
    const obj = {
      status: {
        conditions: [
          {
            type: 'Ready',
            status: 'True',
            reason: 'ReconcileSuccess',
            message: 'All resources are ready',
          },
        ],
      },
    }
    const result = extractReadyStatus(obj)
    expect(result.reason).toBe('ReconcileSuccess')
    expect(result.message).toBe('All resources are ready')
  })

  it('returns empty reason and message when absent', () => {
    const obj = {
      status: {
        conditions: [{ type: 'Ready', status: 'True' }],
      },
    }
    const result = extractReadyStatus(obj)
    expect(result.reason).toBe('')
    expect(result.message).toBe('')
  })
})

// ── extractRGDName ───────────────────────────────────────────────────

describe('extractRGDName', () => {
  it('returns name from metadata', () => {
    expect(extractRGDName({ metadata: { name: 'test-app' } })).toBe('test-app')
  })

  it('returns empty string when metadata missing', () => {
    expect(extractRGDName({})).toBe('')
  })

  it('returns empty string when name is not a string', () => {
    expect(extractRGDName({ metadata: { name: 42 } })).toBe('')
  })
})

// ── extractRGDKind ───────────────────────────────────────────────────

describe('extractRGDKind', () => {
  it('returns kind from spec.schema.kind', () => {
    expect(extractRGDKind({ spec: { schema: { kind: 'WebService' } } })).toBe(
      'WebService',
    )
  })

  it('returns empty string when spec missing', () => {
    expect(extractRGDKind({})).toBe('')
  })

  it('returns empty string when schema missing', () => {
    expect(extractRGDKind({ spec: {} })).toBe('')
  })

  it('returns empty string when kind is not a string', () => {
    expect(extractRGDKind({ spec: { schema: { kind: 123 } } })).toBe('')
  })
})

// ── extractResourceCount ─────────────────────────────────────────────

describe('extractResourceCount', () => {
  it('returns length of spec.resources array', () => {
    expect(
      extractResourceCount({ spec: { resources: [{}, {}, {}] } }),
    ).toBe(3)
  })

  it('returns 0 when spec missing', () => {
    expect(extractResourceCount({})).toBe(0)
  })

  it('returns 0 when resources is not an array', () => {
    expect(extractResourceCount({ spec: { resources: 'nope' } })).toBe(0)
  })
})

// ── readyStateColor ──────────────────────────────────────────────────

describe('readyStateColor', () => {
  it('returns --color-status-ready for ready', () => {
    expect(readyStateColor('ready')).toBe('--color-status-ready')
  })

  it('returns --color-status-error for error', () => {
    expect(readyStateColor('error')).toBe('--color-status-error')
  })

  it('returns --color-status-unknown for unknown', () => {
    expect(readyStateColor('unknown')).toBe('--color-status-unknown')
  })
})

// ── readyStateLabel ──────────────────────────────────────────────────

describe('readyStateLabel', () => {
  it('returns Ready for ready', () => {
    expect(readyStateLabel('ready')).toBe('Ready')
  })

  it('returns Not Ready for error', () => {
    expect(readyStateLabel('error')).toBe('Not Ready')
  })

  it('returns Unknown for unknown', () => {
    expect(readyStateLabel('unknown')).toBe('Unknown')
  })
})

// ── extractInstanceHealth ────────────────────────────────────────────

describe('extractInstanceHealth', () => {
  it("returns 'reconciling' when Progressing=True regardless of Ready value", () => {
    const obj = {
      status: {
        conditions: [
          { type: 'Progressing', status: 'True' },
          { type: 'Ready', status: 'False' },
        ],
      },
    }
    expect(extractInstanceHealth(obj).state).toBe('reconciling')
  })

  it("returns 'reconciling' when Progressing=True and Ready absent", () => {
    const obj = {
      status: {
        conditions: [{ type: 'Progressing', status: 'True' }],
      },
    }
    expect(extractInstanceHealth(obj).state).toBe('reconciling')
  })

  it("returns 'reconciling' when GraphProgressing=True (kro v0.8.x compat)", () => {
    const obj = {
      status: {
        conditions: [
          { type: 'GraphProgressing', status: 'True' },
          { type: 'Ready', status: 'False' },
        ],
      },
    }
    expect(extractInstanceHealth(obj).state).toBe('reconciling')
  })

  it("returns 'reconciling' when kro status.state is IN_PROGRESS (Bug D-1 fix)", () => {
    const obj = {
      status: {
        state: 'IN_PROGRESS',
        conditions: [
          { type: 'InstanceManaged', status: 'True' },
          { type: 'GraphResolved', status: 'True' },
          { type: 'ResourcesReady', status: 'False' },
          { type: 'Ready', status: 'False' },
        ],
      },
    }
    expect(extractInstanceHealth(obj).state).toBe('reconciling')
  })

  it("IN_PROGRESS wins over Ready=False (reconciling > error)", () => {
    const obj = {
      status: {
        state: 'IN_PROGRESS',
        conditions: [{ type: 'Ready', status: 'False' }],
      },
    }
    expect(extractInstanceHealth(obj).state).toBe('reconciling')
  })

  it("ACTIVE kro status.state with Ready=True returns ready (not affected)", () => {
    const obj = {
      status: {
        state: 'ACTIVE',
        conditions: [{ type: 'Ready', status: 'True' }],
      },
    }
    expect(extractInstanceHealth(obj).state).toBe('ready')
  })

  it("returns 'error' when Ready=False and Progressing absent", () => {
    const obj = {
      status: {
        conditions: [{ type: 'Ready', status: 'False', reason: 'CreateFailed', message: 'failed' }],
      },
    }
    const result = extractInstanceHealth(obj)
    expect(result.state).toBe('error')
    expect(result.reason).toBe('CreateFailed')
    expect(result.message).toBe('failed')
  })

  it("returns 'ready' when Ready=True", () => {
    const obj = {
      status: {
        conditions: [{ type: 'Ready', status: 'True', reason: 'ResourcesReady', message: 'all good' }],
      },
    }
    const result = extractInstanceHealth(obj)
    expect(result.state).toBe('ready')
    expect(result.reason).toBe('ResourcesReady')
  })

  it("returns 'unknown' when status.conditions is absent", () => {
    expect(extractInstanceHealth({}).state).toBe('unknown')
  })

  it("returns 'unknown' when status is missing", () => {
    expect(extractInstanceHealth({ metadata: { name: 'test' } }).state).toBe('unknown')
  })

  it("returns 'unknown' when conditions array is empty", () => {
    const obj = { status: { conditions: [] } }
    expect(extractInstanceHealth(obj).state).toBe('unknown')
  })

  it("returns 'pending' when all conditions have status=Unknown", () => {
    const obj = {
      status: {
        conditions: [
          { type: 'Ready', status: 'Unknown' },
          { type: 'Progressing', status: 'Unknown' },
        ],
      },
    }
    expect(extractInstanceHealth(obj).state).toBe('pending')
  })

  it("returns 'unknown' with empty reason/message when called with empty object {}", () => {
    const result = extractInstanceHealth({})
    expect(result.state).toBe('unknown')
    expect(result.reason).toBe('')
    expect(result.message).toBe('')
  })

  it('uses first Ready condition when multiple Ready conditions exist (malformed input)', () => {
    const obj = {
      status: {
        conditions: [
          { type: 'Ready', status: 'True', reason: 'First' },
          { type: 'Ready', status: 'False', reason: 'Second' },
        ],
      },
    }
    // find() returns the first match; state should be 'ready'
    const result = extractInstanceHealth(obj)
    expect(result.state).toBe('ready')
    expect(result.reason).toBe('First')
  })

  it("returns reason and message as '' when condition fields are absent", () => {
    const obj = {
      status: {
        conditions: [{ type: 'Ready', status: 'True' }],
      },
    }
    const result = extractInstanceHealth(obj)
    expect(result.reason).toBe('')
    expect(result.message).toBe('')
  })

  // ── 028-F3: negation-polarity conditions ──────────────────────────────────

  it('returns error when ReconciliationSuspended=True with no Ready condition — fix #220 028-F3', () => {
    // ReconciliationSuspended=True means reconciliation is paused → unhealthy.
    // When there is no Ready condition, isHealthyCondition must catch this.
    const obj = {
      status: {
        conditions: [
          { type: 'ReconciliationSuspended', status: 'True', reason: 'ManualPause' },
        ],
      },
    }
    const result = extractInstanceHealth(obj)
    expect(result.state).toBe('error')
    expect(result.reason).toBe('ManualPause')
  })

  it('returns error when ReconciliationSuspended=True and Ready=Unknown — fix #220 028-F3', () => {
    // Real-world: kro suspends reconciliation → Ready stays Unknown.
    const obj = {
      status: {
        conditions: [
          { type: 'Ready', status: 'Unknown', reason: '' },
          { type: 'ReconciliationSuspended', status: 'True', reason: 'ManualPause' },
        ],
      },
    }
    const result = extractInstanceHealth(obj)
    expect(result.state).toBe('error')
    expect(result.reason).toBe('ManualPause')
  })

  it('returns ready when ReconciliationSuspended=False (negation-polarity healthy)', () => {
    const obj = {
      status: {
        conditions: [
          { type: 'Ready', status: 'True', reason: 'AllGood' },
          { type: 'ReconciliationSuspended', status: 'False', reason: '' },
        ],
      },
    }
    const result = extractInstanceHealth(obj)
    expect(result.state).toBe('ready')
  })
})

// ── aggregateHealth ──────────────────────────────────────────────────

describe('aggregateHealth', () => {
  it('returns all zeros for empty items array', () => {
    const summary = aggregateHealth([])
    expect(summary).toEqual({ total: 0, ready: 0, degraded: 0, error: 0, reconciling: 0, pending: 0, unknown: 0 })
  })

  it('counts totals correctly across mixed states', () => {
    const items = [
      // ready
      { status: { conditions: [{ type: 'Ready', status: 'True' }] } },
      // error
      { status: { conditions: [{ type: 'Ready', status: 'False' }] } },
      // reconciling
      { status: { conditions: [{ type: 'Progressing', status: 'True' }, { type: 'Ready', status: 'False' }] } },
      // unknown (no status)
      {},
      // pending (all Unknown)
      { status: { conditions: [{ type: 'Ready', status: 'Unknown' }] } },
    ]
    const summary = aggregateHealth(items)
    expect(summary.total).toBe(5)
    expect(summary.ready).toBe(1)
    expect(summary.error).toBe(1)
    expect(summary.reconciling).toBe(1)
    expect(summary.unknown).toBe(1)
    expect(summary.pending).toBe(1)
  })

  it('counts all-ready correctly', () => {
    const items = [
      { status: { conditions: [{ type: 'Ready', status: 'True' }] } },
      { status: { conditions: [{ type: 'Ready', status: 'True' }] } },
    ]
    const summary = aggregateHealth(items)
    expect(summary.total).toBe(2)
    expect(summary.ready).toBe(2)
    expect(summary.error).toBe(0)
  })
})

// ── abbreviateContext (issue #117/#123) ────────────────────────────────────

describe('abbreviateContext', () => {
  it('returns short context names as-is', () => {
    expect(abbreviateContext('prod')).toBe('prod')
    expect(abbreviateContext('dev-cluster')).toBe('dev-cluster')
  })

  it('returns empty string for empty input', () => {
    expect(abbreviateContext('')).toBe('')
  })

  it('abbreviates EKS ARN to first6…last3/clusterName format', () => {
    const arn = 'arn:aws:eks:us-east-1:319279230668:cluster/krombat'
    expect(abbreviateContext(arn)).toBe('319279\u2026668/krombat')
  })

  it('disambiguates same cluster name in different accounts', () => {
    const arn1 = 'arn:aws:eks:us-west-2:319279230668:cluster/my-cluster'
    const arn2 = 'arn:aws:eks:us-west-2:569190534191:cluster/my-cluster'
    const label1 = abbreviateContext(arn1)
    const label2 = abbreviateContext(arn2)
    // Both should produce different labels for the same cluster name
    expect(label1).not.toBe(label2)
    // Both should contain the cluster name
    expect(label1).toContain('/my-cluster')
    expect(label2).toContain('/my-cluster')
  })

  it('returns short account IDs without ellipsis', () => {
    // Account ID short enough to show fully
    const arn = 'arn:aws:eks:us-east-1:12345678:cluster/test'
    expect(abbreviateContext(arn)).toBe('12345678/test')
  })

  it('returns non-EKS ARN-format contexts as-is (no guessing)', () => {
    const oidcCtx = 'kubernetes-admin@my.cluster.example.com'
    expect(abbreviateContext(oidcCtx)).toBe(oidcCtx)
  })
})

// ── displayNamespace ─────────────────────────────────────────────────

describe('displayNamespace', () => {
  it('returns "cluster-scoped" for the _ URL sentinel', () => {
    expect(displayNamespace('_')).toBe('cluster-scoped')
  })

  it('returns "cluster-scoped" for empty string', () => {
    expect(displayNamespace('')).toBe('cluster-scoped')
  })

  it('returns "cluster-scoped" for undefined', () => {
    expect(displayNamespace(undefined)).toBe('cluster-scoped')
  })

  it('returns "cluster-scoped" for null', () => {
    expect(displayNamespace(null)).toBe('cluster-scoped')
  })

  it('returns the namespace unchanged for a real namespace', () => {
    expect(displayNamespace('kro-ui-demo')).toBe('kro-ui-demo')
    expect(displayNamespace('default')).toBe('default')
    expect(displayNamespace('kube-system')).toBe('kube-system')
  })
})
