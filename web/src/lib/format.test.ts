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

  it('returns 0s for future timestamp', () => {
    expect(formatAge('2026-03-20T13:00:00Z')).toBe('0s')
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
})

// ── aggregateHealth ──────────────────────────────────────────────────

describe('aggregateHealth', () => {
  it('returns all zeros for empty items array', () => {
    const summary = aggregateHealth([])
    expect(summary).toEqual({ total: 0, ready: 0, error: 0, reconciling: 0, pending: 0, unknown: 0 })
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
