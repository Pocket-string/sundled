import { describe, it, expect } from 'vitest'
import {
  percentile75,
  percentile,
  isEligible,
  classify,
  computePExpected,
  computeUnderperfRatio,
  computeUnderperfDeltaW,
  computeSnapshot,
  computeAllSnapshots,
  parseModuleW,
  computeModuleGroupReference,
} from '../engine'
import type { FactRow } from '../../types'

// ---------------------------------------------------------------------------
// percentile75
// ---------------------------------------------------------------------------
describe('percentile75', () => {
  it('returns 0 for empty array', () => {
    expect(percentile75([])).toBe(0)
  })

  it('returns the value for single-element array', () => {
    expect(percentile75([100])).toBe(100)
  })

  it('computes P75 for even-length array', () => {
    // Sorted: [10, 20, 30, 40]
    // P75 index = 0.75 * 3 = 2.25 → interpolate between 30 and 40
    // = 30 * 0.75 + 40 * 0.25 = 32.5
    expect(percentile75([10, 20, 30, 40])).toBe(32.5)
  })

  it('computes P75 for odd-length array', () => {
    // Sorted: [10, 20, 30, 40, 50]
    // P75 index = 0.75 * 4 = 3 → exactly values[3] = 40
    expect(percentile75([10, 20, 30, 40, 50])).toBe(40)
  })

  it('handles unsorted input', () => {
    expect(percentile75([50, 10, 40, 20, 30])).toBe(40)
  })

  it('handles duplicate values', () => {
    expect(percentile75([100, 100, 100, 100])).toBe(100)
  })
})

describe('percentile (general)', () => {
  it('P50 is the median', () => {
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30)
  })

  it('P0 is the minimum', () => {
    expect(percentile([10, 20, 30], 0)).toBe(10)
  })

  it('P100 is the maximum', () => {
    expect(percentile([10, 20, 30], 1)).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// isEligible
// ---------------------------------------------------------------------------
describe('isEligible', () => {
  it('returns true for valid row', () => {
    expect(isEligible({ poa: 500, p_string: 100, string_id: 'S1' })).toBe(true)
  })

  it('returns false for null poa', () => {
    expect(isEligible({ poa: null, p_string: 100 })).toBe(false)
  })

  it('returns false for poa < 200', () => {
    expect(isEligible({ poa: 199, p_string: 100 })).toBe(false)
  })

  it('returns false for poa = 200 (boundary)', () => {
    expect(isEligible({ poa: 200, p_string: 100 })).toBe(true)
  })

  it('returns false for null p_string', () => {
    expect(isEligible({ poa: 500, p_string: null })).toBe(false)
  })

  it('returns false for p_string = 0', () => {
    expect(isEligible({ poa: 500, p_string: 0 })).toBe(false)
  })

  it('returns false for NaN poa', () => {
    expect(isEligible({ poa: NaN, p_string: 100 })).toBe(false)
  })

  it('returns false for NaN p_string', () => {
    expect(isEligible({ poa: 500, p_string: NaN })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// classify
// ---------------------------------------------------------------------------
describe('classify', () => {
  it('returns green for ratio >= 0.95', () => {
    expect(classify(0.95)).toBe('green')
    expect(classify(1.0)).toBe('green')
    expect(classify(1.5)).toBe('green')
  })

  it('returns blue for 0.80 <= ratio < 0.95', () => {
    expect(classify(0.80)).toBe('blue')
    expect(classify(0.90)).toBe('blue')
    expect(classify(0.9499)).toBe('blue')
  })

  it('returns orange for 0.60 <= ratio < 0.80', () => {
    expect(classify(0.60)).toBe('orange')
    expect(classify(0.70)).toBe('orange')
    expect(classify(0.7999)).toBe('orange')
  })

  it('returns red for ratio < 0.60', () => {
    expect(classify(0.59)).toBe('red')
    expect(classify(0.3)).toBe('red')
    expect(classify(0.0)).toBe('red')
  })

  it('returns gray for null', () => {
    expect(classify(null)).toBe('gray')
  })

  it('returns gray for NaN', () => {
    expect(classify(NaN)).toBe('gray')
  })
})

// ---------------------------------------------------------------------------
// computeUnderperfRatio / computeUnderperfDeltaW
// ---------------------------------------------------------------------------
describe('computeUnderperfRatio', () => {
  it('computes ratio correctly', () => {
    expect(computeUnderperfRatio(80, 100)).toBe(0.8)
  })

  it('returns null for null p_expected', () => {
    expect(computeUnderperfRatio(80, null)).toBeNull()
  })

  it('returns null for p_expected <= 0', () => {
    expect(computeUnderperfRatio(80, 0)).toBeNull()
    expect(computeUnderperfRatio(80, -10)).toBeNull()
  })
})

describe('computeUnderperfDeltaW', () => {
  it('computes delta correctly', () => {
    expect(computeUnderperfDeltaW(80, 100)).toBe(20)
  })

  it('returns 0 when p_string exceeds p_expected', () => {
    expect(computeUnderperfDeltaW(120, 100)).toBe(0)
  })

  it('returns null for null p_expected', () => {
    expect(computeUnderperfDeltaW(80, null)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// computePExpected (4-level fallback)
// ---------------------------------------------------------------------------
describe('computePExpected', () => {
  const makeHistory = (count: number, poa: number, pString: number): FactRow[] =>
    Array.from({ length: count }, (_, i) => ({
      string_id: 'S1',
      poa,
      p_string: pString + i * 0.1,
      i_string: null,
      v_string: null,
      ts: `2025-01-${String(i + 1).padStart(2, '0')}T12:00:00`,
    }))

  it('uses same_string_p75 when enough tight matches', () => {
    const history = makeHistory(15, 500, 100) // all poa=500
    const result = computePExpected({
      currentPoa: 500, // |500-500| = 0 <= 50
      stringHistory: history,
      peerGroupRows: [],
    })
    expect(result.reference_method).toBe('same_string_p75')
    expect(result.reference_sample_size).toBe(15)
    expect(result.p_expected).toBeGreaterThan(0)
  })

  it('falls to relaxed_p75 when tight matches insufficient', () => {
    // History at poa=500, current poa=430 → |500-430|=70 > 50, but <= 100
    const history = makeHistory(15, 500, 100)
    const result = computePExpected({
      currentPoa: 430,
      stringHistory: history,
      peerGroupRows: [],
    })
    expect(result.reference_method).toBe('same_string_relaxed_p75')
    expect(result.reference_sample_size).toBe(15)
  })

  it('falls to peer_group_fallback when string history insufficient', () => {
    const history = makeHistory(3, 500, 100) // only 3 rows, < 12
    const peerRows: FactRow[] = Array.from({ length: 8 }, (_, i) => ({
      string_id: `PEER_${i}`,
      poa: 500,
      p_string: 100 + i,
      i_string: null,
      v_string: null,
      ts: '2025-01-15T12:00:00',
    }))

    const result = computePExpected({
      currentPoa: 500,
      stringHistory: history,
      peerGroupRows: peerRows,
    })
    expect(result.reference_method).toBe('peer_group_fallback')
    expect(result.reference_sample_size).toBe(8)
  })

  it('falls to insufficient_data when nothing works', () => {
    const result = computePExpected({
      currentPoa: 500,
      stringHistory: [],
      peerGroupRows: [],
    })
    expect(result.reference_method).toBe('insufficient_data')
    expect(result.p_expected).toBeNull()
    expect(result.reference_sample_size).toBe(0)
  })

  it('tight match filter respects poa tolerance', () => {
    // History poa=500, current poa=560 → |500-560|=60 > 50
    // So tight fails, but relaxed (|60| <= 100) succeeds
    const history = makeHistory(15, 500, 100)
    const result = computePExpected({
      currentPoa: 560,
      stringHistory: history,
      peerGroupRows: [],
    })
    expect(result.reference_method).toBe('same_string_relaxed_p75')
  })

  it('peer_group_fallback requires >= 5 rows', () => {
    const peerRows: FactRow[] = Array.from({ length: 4 }, (_, i) => ({
      string_id: `PEER_${i}`,
      poa: 500,
      p_string: 100,
      i_string: null,
      v_string: null,
      ts: '',
    }))

    const result = computePExpected({
      currentPoa: 500,
      stringHistory: [],
      peerGroupRows: peerRows,
    })
    expect(result.reference_method).toBe('insufficient_data')
  })
})

// ---------------------------------------------------------------------------
// computeSnapshot
// ---------------------------------------------------------------------------
describe('computeSnapshot', () => {
  it('returns gray for ineligible row', () => {
    const row: FactRow = {
      string_id: 'S1',
      poa: 50, // below 200
      p_string: 100,
      i_string: 5,
      v_string: 20,
      ts: '2025-01-15T12:00:00',
    }

    const result = computeSnapshot({
      row,
      plantId: 'PLT_A',
      tsUtc: '2025-01-15T12:00:00',
      tsLocal: '2025-01-15T12:00:00',
      stringHistory: [],
      peerGroupRows: [],
    })

    expect(result.class).toBe('gray')
    expect(result.reference_method).toBe('insufficient_data')
    expect(result.p_expected).toBeNull()
  })

  it('computes full snapshot for eligible row with history', () => {
    const row: FactRow = {
      string_id: 'S1',
      poa: 500,
      p_string: 80,
      i_string: 4,
      v_string: 20,
      ts: '2025-01-15T12:00:00',
    }

    const history: FactRow[] = Array.from({ length: 15 }, (_, i) => ({
      string_id: 'S1',
      poa: 500,
      p_string: 100 + i,
      i_string: null,
      v_string: null,
      ts: '',
    }))

    const result = computeSnapshot({
      row,
      plantId: 'PLT_A',
      tsUtc: '2025-01-15T12:00:00',
      tsLocal: '2025-01-15T12:00:00',
      stringHistory: history,
      peerGroupRows: [],
    })

    expect(result.class).toBe('orange') // 80 / ~110 = ~0.73
    expect(result.reference_method).toBe('same_string_p75')
    expect(result.p_expected).toBeGreaterThan(0)
    expect(result.underperf_ratio).toBeLessThan(0.80) // 60-80% = orange
    expect(result.underperf_delta_w).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// computeAllSnapshots
// ---------------------------------------------------------------------------
describe('computeAllSnapshots', () => {
  it('computes snapshots for all rows at a timestamp', () => {
    const currentRows: FactRow[] = [
      { string_id: 'S1', poa: 500, p_string: 100, i_string: 5, v_string: 20, ts: '', peer_group: 'G1' },
      { string_id: 'S2', poa: 500, p_string: 50, i_string: 2.5, v_string: 20, ts: '', peer_group: 'G1' },
      { string_id: 'S3', poa: null, p_string: null, i_string: null, v_string: null, ts: '', peer_group: 'G1' },
    ]

    const results = computeAllSnapshots({
      plantId: 'PLT_A',
      tsUtc: '2025-01-15T12:00:00',
      tsLocal: '2025-01-15T12:00:00',
      currentRows,
      historyByString: new Map(),
    })

    expect(results).toHaveLength(3)
    expect(results[2].class).toBe('gray') // null poa
  })
})

// ---------------------------------------------------------------------------
// parseModuleW
// ---------------------------------------------------------------------------
describe('parseModuleW', () => {
  it('parses "2x540" → 540', () => {
    expect(parseModuleW('2x540')).toBe(540)
  })

  it('parses "3x545" → 545', () => {
    expect(parseModuleW('3x545')).toBe(545)
  })

  it('parses "1x400" → 400', () => {
    expect(parseModuleW('1x400')).toBe(400)
  })

  it('returns null for null', () => {
    expect(parseModuleW(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(parseModuleW(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseModuleW('')).toBeNull()
  })

  it('returns null for invalid format', () => {
    expect(parseModuleW('invalid')).toBeNull()
    expect(parseModuleW('540')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// computeModuleGroupReference
// ---------------------------------------------------------------------------
describe('computeModuleGroupReference', () => {
  const makeGroupRows = (count: number, peerGroup: string, basePower: number): FactRow[] =>
    Array.from({ length: count }, (_, i) => ({
      string_id: `${peerGroup}_S${i}`,
      peer_group: peerGroup,
      poa: 800,
      p_string: basePower + i * 2,
      i_string: null,
      v_string: null,
      ts: '2025-01-15T12:00:00',
    }))

  it('computes P75 for a group with >= 5 strings', () => {
    const rows = makeGroupRows(10, '2x540', 100)
    const refs = computeModuleGroupReference(rows)
    expect(refs.has('540')).toBe(true)
    expect(refs.get('540')).toBeGreaterThan(0)
  })

  it('excludes groups with < 5 strings', () => {
    const rows = makeGroupRows(4, '2x540', 100)
    const refs = computeModuleGroupReference(rows)
    expect(refs.has('540')).toBe(false)
  })

  it('computes separate P75 for multiple module groups', () => {
    const rows540 = makeGroupRows(10, '2x540', 100)
    const rows545 = makeGroupRows(10, '3x545', 120)
    const refs = computeModuleGroupReference([...rows540, ...rows545])
    expect(refs.has('540')).toBe(true)
    expect(refs.has('545')).toBe(true)
    // 545W group has higher base power → higher P75
    expect(refs.get('545')!).toBeGreaterThan(refs.get('540')!)
  })

  it('excludes ineligible rows (low POA)', () => {
    const rows: FactRow[] = Array.from({ length: 10 }, (_, i) => ({
      string_id: `S${i}`,
      peer_group: '2x540',
      poa: 100, // below 200 threshold
      p_string: 100 + i,
      i_string: null,
      v_string: null,
      ts: '',
    }))
    const refs = computeModuleGroupReference(rows)
    expect(refs.size).toBe(0) // all ineligible
  })

  it('excludes rows with null peer_group', () => {
    const rows: FactRow[] = Array.from({ length: 10 }, (_, i) => ({
      string_id: `S${i}`,
      peer_group: null,
      poa: 800,
      p_string: 100 + i,
      i_string: null,
      v_string: null,
      ts: '',
    }))
    const refs = computeModuleGroupReference(rows)
    expect(refs.size).toBe(0)
  })

  it('respects custom minGroupSize', () => {
    const rows = makeGroupRows(3, '2x540', 100)
    // Default minGroupSize = 5 → excluded
    expect(computeModuleGroupReference(rows).size).toBe(0)
    // Custom minGroupSize = 3 → included
    expect(computeModuleGroupReference(rows, 3).has('540')).toBe(true)
  })

  it('respects custom minPoa threshold', () => {
    const rows: FactRow[] = Array.from({ length: 10 }, (_, i) => ({
      string_id: `S${i}`,
      peer_group: '2x540',
      poa: 100, // below default 200 but above custom 50
      p_string: 100 + i,
      i_string: null,
      v_string: null,
      ts: '',
    }))
    // Default minPoa = 200 → excluded
    expect(computeModuleGroupReference(rows).size).toBe(0)
    // Custom minPoa = 50 → included
    expect(computeModuleGroupReference(rows, 5, 50).has('540')).toBe(true)
  })
})
