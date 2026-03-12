/**
 * Analytics Engine v1 — Pure functions for string performance analysis.
 *
 * No Supabase dependency. Receives data arrays, returns computed results.
 * Implements the 4-level p_expected fallback defined in TICKET-002.
 */

import type {
  AnalyticsClass,
  AnalyticsSnapshot,
  FactRow,
  PExpectedResult,
  ReferenceMethod,
} from '../types'

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/** A row can participate in analytics only if it has valid POA >= 200 and p_string > 0 */
export function isEligible(row: { poa: number | null; p_string: number | null; string_id?: string }): boolean {
  return (
    row.poa !== null &&
    !isNaN(row.poa) &&
    row.poa >= 200 &&
    row.p_string !== null &&
    !isNaN(row.p_string) &&
    row.p_string > 0
  )
}

// ---------------------------------------------------------------------------
// Percentile
// ---------------------------------------------------------------------------

/** Compute interpolated percentile (0-1) from a sorted array of numbers */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  if (values.length === 1) return values[0]

  const sorted = [...values].sort((a, b) => a - b)
  const index = p * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower

  if (upper >= sorted.length) return sorted[sorted.length - 1]
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

/** Shorthand for P75 */
export function percentile75(values: number[]): number {
  return percentile(values, 0.75)
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export function classify(ratio: number | null): AnalyticsClass {
  if (ratio === null || isNaN(ratio)) return 'gray'
  if (ratio >= 0.95) return 'green'
  if (ratio >= 0.80) return 'blue'
  if (ratio >= 0.60) return 'orange'
  return 'red'
}

// ---------------------------------------------------------------------------
// p_expected computation (4-level fallback)
// ---------------------------------------------------------------------------

interface ComputePExpectedParams {
  currentPoa: number
  /** Historical rows for the SAME string (last 30 days), already filtered to eligible */
  stringHistory: FactRow[]
  /** Rows from the SAME peer_group at the SAME timestamp, already filtered to eligible */
  peerGroupRows: FactRow[]
}

export function computePExpected({
  currentPoa,
  stringHistory,
  peerGroupRows,
}: ComputePExpectedParams): PExpectedResult {
  // Method 1 — same_string_p75: |poa - current_poa| <= 50, n >= 12
  const tightMatches = stringHistory.filter(
    (r) => r.poa !== null && Math.abs(r.poa - currentPoa) <= 50
  )
  if (tightMatches.length >= 12) {
    return {
      p_expected: percentile75(tightMatches.map((r) => r.p_string!)),
      reference_method: 'same_string_p75',
      reference_sample_size: tightMatches.length,
    }
  }

  // Method 2 — same_string_relaxed_p75: |poa - current_poa| <= 100, n >= 12
  const relaxedMatches = stringHistory.filter(
    (r) => r.poa !== null && Math.abs(r.poa - currentPoa) <= 100
  )
  if (relaxedMatches.length >= 12) {
    return {
      p_expected: percentile75(relaxedMatches.map((r) => r.p_string!)),
      reference_method: 'same_string_relaxed_p75',
      reference_sample_size: relaxedMatches.length,
    }
  }

  // Method 3 — peer_group_fallback: same peer_group at same timestamp, n >= 5
  if (peerGroupRows.length >= 5) {
    return {
      p_expected: percentile75(peerGroupRows.map((r) => r.p_string!)),
      reference_method: 'peer_group_fallback',
      reference_sample_size: peerGroupRows.length,
    }
  }

  // Method 4 — insufficient_data
  return {
    p_expected: null,
    reference_method: 'insufficient_data',
    reference_sample_size: 0,
  }
}

// ---------------------------------------------------------------------------
// Underperformance metrics
// ---------------------------------------------------------------------------

export function computeUnderperfRatio(
  pString: number,
  pExpected: number | null
): number | null {
  if (pExpected === null || pExpected <= 0) return null
  return pString / pExpected
}

export function computeUnderperfDeltaW(
  pString: number,
  pExpected: number | null
): number | null {
  if (pExpected === null) return null
  return Math.max(pExpected - pString, 0)
}

// ---------------------------------------------------------------------------
// Full snapshot computation for a single row
// ---------------------------------------------------------------------------

interface ComputeSnapshotParams {
  row: FactRow
  plantId: string
  tsUtc: string
  tsLocal: string
  stringHistory: FactRow[]
  peerGroupRows: FactRow[]
}

export function computeSnapshot({
  row,
  plantId,
  tsUtc,
  tsLocal,
  stringHistory,
  peerGroupRows,
}: ComputeSnapshotParams): Omit<AnalyticsSnapshot, 'id' | 'org_id' | 'computed_at'> {
  const eligible = isEligible(row)

  if (!eligible) {
    return {
      plant_id: plantId,
      ts_utc: tsUtc,
      ts_local: tsLocal,
      string_id: row.string_id,
      svg_id: row.svg_id ?? null,
      inverter_id: row.inverter_id ?? null,
      tracker_id: row.tracker_id ?? null,
      dc_in: row.dc_in ?? null,
      peer_group: row.peer_group ?? null,
      poa: sanitize(row.poa),
      t_mod: sanitize(row.t_mod ?? null),
      i_string: sanitize(row.i_string),
      v_string: sanitize(row.v_string),
      p_string: sanitize(row.p_string),
      p_expected: null,
      underperf_ratio: null,
      underperf_delta_w: null,
      class: 'gray',
      reference_method: 'insufficient_data',
      reference_sample_size: 0,
    }
  }

  const { p_expected, reference_method, reference_sample_size } = computePExpected({
    currentPoa: row.poa!,
    stringHistory,
    peerGroupRows,
  })

  const ratio = computeUnderperfRatio(row.p_string!, p_expected)
  const deltaW = computeUnderperfDeltaW(row.p_string!, p_expected)

  return {
    plant_id: plantId,
    ts_utc: tsUtc,
    ts_local: tsLocal,
    string_id: row.string_id,
    svg_id: row.svg_id ?? null,
    inverter_id: row.inverter_id ?? null,
    tracker_id: row.tracker_id ?? null,
    dc_in: row.dc_in ?? null,
    peer_group: row.peer_group ?? null,
    poa: sanitize(row.poa),
    t_mod: sanitize(row.t_mod ?? null),
    i_string: sanitize(row.i_string),
    v_string: sanitize(row.v_string),
    p_string: sanitize(row.p_string),
    p_expected,
    underperf_ratio: ratio,
    underperf_delta_w: deltaW,
    class: classify(ratio),
    reference_method,
    reference_sample_size,
  }
}

// ---------------------------------------------------------------------------
// Batch computation for all strings at a single timestamp
// ---------------------------------------------------------------------------

interface ComputeAllSnapshotsParams {
  plantId: string
  tsUtc: string
  tsLocal: string
  /** All fact rows at the target timestamp */
  currentRows: FactRow[]
  /** All eligible fact rows for the plant in the last 30 days (keyed by string_id) */
  historyByString: Map<string, FactRow[]>
}

export function computeAllSnapshots({
  plantId,
  tsUtc,
  tsLocal,
  currentRows,
  historyByString,
}: ComputeAllSnapshotsParams): Omit<AnalyticsSnapshot, 'id' | 'org_id' | 'computed_at'>[] {
  // Build peer group rows from current eligible rows
  const peerGroupMap = new Map<string, FactRow[]>()
  for (const row of currentRows) {
    if (isEligible(row) && row.peer_group) {
      const arr = peerGroupMap.get(row.peer_group) ?? []
      arr.push(row)
      peerGroupMap.set(row.peer_group, arr)
    }
  }

  return currentRows.map((row) => {
    const stringHistory = (historyByString.get(row.string_id) ?? []).filter(isEligible)
    const peerRows = row.peer_group
      ? (peerGroupMap.get(row.peer_group) ?? []).filter((r) => r.string_id !== row.string_id)
      : []

    return computeSnapshot({
      row,
      plantId,
      tsUtc,
      tsLocal,
      stringHistory,
      peerGroupRows: peerRows,
    })
  })
}

// ---------------------------------------------------------------------------
// Module-group reference (primary method for demo/production)
// ---------------------------------------------------------------------------

/** Extract module wattage from peer_group string: "2x540" → 540, "3x545" → 545 */
export function parseModuleW(peerGroup: string | null | undefined): number | null {
  if (!peerGroup) return null
  const match = peerGroup.match(/x(\d+)/)
  if (!match) return null
  const n = parseInt(match[1], 10)
  return isNaN(n) ? null : n
}

/**
 * Compute P75 reference power per module-wattage group at a single timestamp.
 * Only includes groups with >= minGroupSize eligible strings.
 * @param minPoa - minimum POA threshold for row eligibility (default 200)
 * Returns Map<module_w_string, p75_reference>
 */
export function computeModuleGroupReference(
  rows: FactRow[],
  minGroupSize = 5,
  minPoa = 200
): Map<string, number> {
  const groups = new Map<string, number[]>()

  for (const row of rows) {
    if (row.poa === null || isNaN(row.poa) || row.poa < minPoa) continue
    if (row.p_string === null || isNaN(row.p_string) || row.p_string <= 0) continue
    const mw = parseModuleW(row.peer_group)
    if (mw === null) continue
    const key = String(mw)
    const arr = groups.get(key) ?? []
    arr.push(row.p_string)
    groups.set(key, arr)
  }

  const refs = new Map<string, number>()
  for (const [key, values] of groups) {
    if (values.length >= minGroupSize) {
      refs.set(key, percentile75(values))
    }
  }

  return refs
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitize(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}
