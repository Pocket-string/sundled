import { createSunalizeClient } from '@/lib/supabase/server'
import type { AnalyticsSnapshot, AnalyticsClass, FactRow, DailyStringSummary } from '../types'
import { classify, percentile, computeModuleGroupReference, parseModuleW } from '../lib/engine'
import { getLatestFullDateDemo, getAvailableTimestampsDemo } from './getAvailableDates'

export interface SnapshotResult {
  snapshots: AnalyticsSnapshot[]
  timestamp: string | null
  date: string | null
  greenCount: number
  blueCount: number
  orangeCount: number
  redCount: number
  grayCount: number
  totalStrings: number
  avgPoa: number | null
  /** 'peak_energy' = module-group P75 over top 5% POA timestamps; 'daily_summary' = pre-aggregated daily_string_summary row */
  analysisMode: 'timestamp' | 'daily_window' | 'peak_energy' | 'daily_summary'
  /** First selected timestamp in the window (HH:MM) */
  windowStart?: string | null
  /** Last selected timestamp in the window (HH:MM) */
  windowEnd?: string | null
  /** Number of selected timestamps */
  windowIntervals?: number
  /** POA threshold (P95) used for peak selection */
  peakPoaThreshold?: number | null
}

/**
 * Module-Group Energy Performance Index for demo routes.
 *
 * Strategy:
 *   1. Sample timestamps and POA from a single representative string
 *   2. Select top ~5% POA timestamps (P95 threshold)
 *   3. For each peak timestamp, query all strings (each query ~693 rows, under PostgREST 1000-row limit)
 *   4. Compute P75(p_string) per module group (540W/545W)
 *   5. Aggregate as energy: PI_string = Σ(p_actual) / Σ(p_ref_group)
 */
export async function getAnalyticsSnapshotDemo(
  plantId: string,
  requestedDate?: string,
  _requestedTs?: string
): Promise<SnapshotResult> {
  const supabase = createSunalizeClient()

  const date = requestedDate ?? (await getLatestDateDemo(plantId))
  if (!date) return emptyResult()

  // Step 1: Get timestamps and POA from a single representative string
  // This is fast: one string × ~48 timestamps = ~48 rows
  const timestamps = await getAvailableTimestampsDemo(plantId, date)

  // Fallback: no intraday data for this date — use daily_string_summary
  if (timestamps.length === 0) {
    return getAnalyticsSnapshotFromDailySummary(supabase, plantId, date)
  }

  // Step 2: Select peak timestamps (top 5% POA)
  const eligibleTs = timestamps.filter((t) => t.avgPoa >= 50)
  if (eligibleTs.length === 0) return emptyResult()

  const eligiblePoas = eligibleTs.map((t) => t.avgPoa)
  let poaThreshold = percentile(eligiblePoas, 0.95)

  // Guarantee at least 2 peak timestamps — lower threshold if needed
  let peakTs = eligibleTs.filter((t) => t.avgPoa >= poaThreshold)
  if (peakTs.length < 2 && eligibleTs.length >= 2) {
    poaThreshold = percentile(eligiblePoas, 0.90)
    peakTs = eligibleTs.filter((t) => t.avgPoa >= poaThreshold)
  }
  if (peakTs.length < 2 && eligibleTs.length >= 2) {
    poaThreshold = percentile(eligiblePoas, 0.80)
    peakTs = eligibleTs.filter((t) => t.avgPoa >= poaThreshold)
  }
  if (peakTs.length < 2) {
    peakTs = eligibleTs
    poaThreshold = Math.min(...eligiblePoas)
  }

  const peakTimestamps = peakTs.map((t) => t.ts).sort()

  // Step 3: For each peak timestamp, fetch all strings
  // Each query returns ~693 rows — well under the PostgREST 1000-row limit
  // (PostgREST caps responses at 1000 rows regardless of .limit())
  interface StringAgg {
    string_id: string
    svg_id: string | null
    inverter_id: string | null
    peer_group: string | null
    module_w: number | null
    sumP: number
    sumPRef: number
    sumPoa: number
    count: number
    groupSize: number
  }

  const aggMap = new Map<string, StringAgg>()

  // Fetch all peak timestamps in parallel for speed
  const tsQueries = peakTimestamps.map((ts) =>
    supabase
      .from('fact_string')
      .select('string_id, svg_id, inverter_id, peer_group, poa, t_mod, i_string, v_string, p_string')
      .eq('plant_id', plantId)
      .eq('Fecha', ts)
      .limit(1000)
      .then(({ data, error }) => {
        if (error) console.error(`[getAnalyticsSnapshotDemo] Query error for ${ts}:`, error.message)
        return { ts, data: data ?? [] }
      })
  )

  const tsResults = await Promise.all(tsQueries)

  // Track all strings seen (for adding 'gray' snapshots for those without valid data)
  const allStrings = new Map<string, { svg_id: string | null; inverter_id: string | null; peer_group: string | null }>()

  for (const { ts, data: tsRawRows } of tsResults) {
    if (tsRawRows.length === 0) continue

    const factRows: FactRow[] = tsRawRows.map((r) => ({
      string_id: r.string_id,
      svg_id: r.svg_id,
      inverter_id: r.inverter_id,
      peer_group: r.peer_group,
      poa: sanitize(r.poa),
      t_mod: sanitize(r.t_mod),
      i_string: sanitize(r.i_string),
      v_string: sanitize(r.v_string),
      p_string: sanitize(r.p_string),
      module_w: parseModuleW(r.peer_group),
      ts,
    }))

    // Register all strings (including those with NaN/null data)
    for (const row of factRows) {
      if (!allStrings.has(row.string_id)) {
        allStrings.set(row.string_id, {
          svg_id: row.svg_id ?? null,
          inverter_id: row.inverter_id ?? null,
          peer_group: row.peer_group ?? null,
        })
      }
    }

    // Compute P75 reference per module group at this timestamp
    const moduleRefs = computeModuleGroupReference(factRows, 5, 50)

    // Count group sizes for sample_size metadata
    const groupSizes = new Map<string, number>()
    for (const row of factRows) {
      if (row.p_string === null || row.p_string <= 0) continue
      if (row.poa === null || row.poa <= 0) continue
      const mw = parseModuleW(row.peer_group)
      if (mw === null) continue
      const key = String(mw)
      groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1)
    }

    for (const row of factRows) {
      if (row.p_string === null || row.p_string <= 0) continue
      if (row.poa === null || row.poa <= 0) continue

      const mw = parseModuleW(row.peer_group)
      if (mw === null) continue
      const mwKey = String(mw)
      const pRef = moduleRefs.get(mwKey)
      if (pRef === undefined) continue

      const agg = aggMap.get(row.string_id) ?? {
        string_id: row.string_id,
        svg_id: row.svg_id ?? null,
        inverter_id: row.inverter_id ?? null,
        peer_group: row.peer_group ?? null,
        module_w: mw,
        sumP: 0,
        sumPRef: 0,
        sumPoa: 0,
        count: 0,
        groupSize: 0,
      }

      agg.sumP += row.p_string!
      agg.sumPRef += pRef
      if (row.poa !== null) agg.sumPoa += row.poa
      agg.count++
      agg.groupSize = groupSizes.get(mwKey) ?? 0

      aggMap.set(row.string_id, agg)
    }
  }

  // Step 6: Compute PI and classify each string
  const snapshots: AnalyticsSnapshot[] = []

  for (const [, agg] of aggMap) {
    const ratio = agg.sumPRef > 0 ? agg.sumP / agg.sumPRef : null
    const clazz: AnalyticsClass = classify(ratio)
    const deltaW = agg.sumPRef > 0
      ? Math.round(Math.max(agg.sumPRef - agg.sumP, 0) / agg.count)
      : null

    snapshots.push({
      plant_id: plantId,
      ts_utc: peakTimestamps[0],
      ts_local: peakTimestamps[0],
      string_id: agg.string_id,
      svg_id: agg.svg_id,
      inverter_id: agg.inverter_id,
      tracker_id: null,
      dc_in: null,
      peer_group: agg.peer_group,
      module_w: agg.module_w,
      poa: agg.count > 0 ? Math.round(agg.sumPoa / agg.count) : null,
      t_mod: null,
      i_string: null,
      v_string: null,
      p_string: agg.count > 0 ? Math.round(agg.sumP / agg.count) : null,
      p_expected: agg.sumPRef > 0 ? Math.round(agg.sumPRef / agg.count) : null,
      underperf_ratio: ratio,
      underperf_delta_w: deltaW,
      class: clazz,
      reference_method: 'module_group_p75',
      reference_sample_size: agg.groupSize,
    })
  }

  // Step 7: Add 'gray' snapshots for strings without valid data (NaN p_string, etc.)
  for (const [stringId, meta] of allStrings) {
    if (aggMap.has(stringId)) continue
    snapshots.push({
      plant_id: plantId,
      ts_utc: peakTimestamps[0],
      ts_local: peakTimestamps[0],
      string_id: stringId,
      svg_id: meta.svg_id,
      inverter_id: meta.inverter_id,
      tracker_id: null,
      dc_in: null,
      peer_group: meta.peer_group,
      module_w: parseModuleW(meta.peer_group),
      poa: null,
      t_mod: null,
      i_string: null,
      v_string: null,
      p_string: null,
      p_expected: null,
      underperf_ratio: null,
      underperf_delta_w: null,
      class: 'gray',
      reference_method: 'insufficient_data',
      reference_sample_size: 0,
    })
  }

  // Summary counts
  let green = 0, blue = 0, orange = 0, red = 0, gray = 0
  const poaValues: number[] = []
  for (const s of snapshots) {
    if (s.class === 'green') green++
    else if (s.class === 'blue') blue++
    else if (s.class === 'orange') orange++
    else if (s.class === 'red') red++
    else gray++
    if (s.poa !== null) poaValues.push(s.poa)
  }

  return {
    snapshots,
    timestamp: peakTimestamps[0] ?? null,
    date,
    greenCount: green,
    blueCount: blue,
    orangeCount: orange,
    redCount: red,
    grayCount: gray,
    totalStrings: snapshots.length,
    avgPoa: poaValues.length > 0
      ? Math.round(poaValues.reduce((a, b) => a + b, 0) / poaValues.length)
      : null,
    analysisMode: 'peak_energy',
    windowStart: peakTimestamps[0]?.substring(11, 16) ?? null,
    windowEnd: peakTimestamps[peakTimestamps.length - 1]?.substring(11, 16) ?? null,
    windowIntervals: peakTimestamps.length,
    peakPoaThreshold: Math.round(poaThreshold),
  }
}

async function getLatestDateDemo(plantId: string): Promise<string | null> {
  return getLatestFullDateDemo(plantId)
}

/**
 * Builds a SnapshotResult from daily_string_summary rows when fact_string
 * has no intraday data for the requested date (historical dates).
 */
async function getAnalyticsSnapshotFromDailySummary(
  supabase: ReturnType<typeof createSunalizeClient>,
  plantId: string,
  date: string
): Promise<SnapshotResult> {
  const { data, error } = await supabase
    .from('daily_string_summary')
    .select(
      'string_id, svg_id, inverter_id, peer_group, module_w, p_string_avg, p_expected_avg, underperf_ratio, class, avg_poa, peak_poa_threshold, peak_intervals'
    )
    .eq('plant_id', plantId)
    .eq('date', date)
    .limit(2000)

  if (error) {
    console.error('[getAnalyticsSnapshotDemo] daily_string_summary query error:', error.message)
    return emptyResult()
  }

  if (!data || data.length === 0) return emptyResult()

  const rows = data as Pick<
    DailyStringSummary,
    | 'string_id'
    | 'svg_id'
    | 'inverter_id'
    | 'peer_group'
    | 'module_w'
    | 'p_string_avg'
    | 'p_expected_avg'
    | 'underperf_ratio'
    | 'class'
    | 'avg_poa'
    | 'peak_poa_threshold'
    | 'peak_intervals'
  >[]

  const snapshots: AnalyticsSnapshot[] = rows.map((row) => ({
    plant_id: plantId,
    ts_utc: date,
    ts_local: date,
    string_id: row.string_id,
    svg_id: row.svg_id,
    inverter_id: row.inverter_id,
    tracker_id: null,
    dc_in: null,
    peer_group: row.peer_group,
    module_w: row.module_w ?? null,
    poa: row.avg_poa !== null ? Math.round(row.avg_poa) : null,
    t_mod: null,
    i_string: null,
    v_string: null,
    p_string: row.p_string_avg !== null ? Math.round(row.p_string_avg) : null,
    p_expected: row.p_expected_avg !== null ? Math.round(row.p_expected_avg) : null,
    underperf_ratio: row.underperf_ratio ?? null,
    underperf_delta_w: null,
    class: (row.class as AnalyticsClass) ?? 'gray',
    reference_method: 'module_group_p75',
    reference_sample_size: 0,
  }))

  let green = 0, blue = 0, orange = 0, red = 0, gray = 0
  const poaValues: number[] = []
  for (const s of snapshots) {
    if (s.class === 'green') green++
    else if (s.class === 'blue') blue++
    else if (s.class === 'orange') orange++
    else if (s.class === 'red') red++
    else gray++
    if (s.poa !== null) poaValues.push(s.poa)
  }

  // Representative values from the first row (all rows share the same daily context)
  const firstRow = rows[0]
  const peakPoaThreshold = firstRow.peak_poa_threshold !== null
    ? Math.round(firstRow.peak_poa_threshold)
    : null
  const windowIntervals = firstRow.peak_intervals ?? 0

  return {
    snapshots,
    timestamp: date,
    date,
    greenCount: green,
    blueCount: blue,
    orangeCount: orange,
    redCount: red,
    grayCount: gray,
    totalStrings: snapshots.length,
    avgPoa: poaValues.length > 0
      ? Math.round(poaValues.reduce((a, b) => a + b, 0) / poaValues.length)
      : null,
    analysisMode: 'daily_summary',
    windowStart: null,
    windowEnd: null,
    windowIntervals,
    peakPoaThreshold,
  }
}

function emptyResult(): SnapshotResult {
  return {
    snapshots: [],
    timestamp: null,
    date: null,
    greenCount: 0,
    blueCount: 0,
    orangeCount: 0,
    redCount: 0,
    grayCount: 0,
    totalStrings: 0,
    avgPoa: null,
    analysisMode: 'peak_energy',
  }
}

function sanitize(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}
