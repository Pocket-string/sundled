export type AnalyticsClass = 'green' | 'blue' | 'orange' | 'red' | 'gray'

export type ReferenceMethod =
  | 'module_group_p75'
  | 'same_string_p75'
  | 'same_string_relaxed_p75'
  | 'peer_group_fallback'
  | 'insufficient_data'

/** Mirrors public.string_analytics_snapshots row */
export interface AnalyticsSnapshot {
  id?: string
  org_id?: string
  plant_id: string
  ts_utc: string
  ts_local: string
  string_id: string
  svg_id: string | null
  inverter_id: string | null
  tracker_id: string | null
  dc_in: number | null
  peer_group: string | null
  poa: number | null
  t_mod: number | null
  i_string: number | null
  v_string: number | null
  p_string: number | null
  p_expected: number | null
  underperf_ratio: number | null
  underperf_delta_w: number | null
  class: AnalyticsClass
  reference_method: ReferenceMethod
  reference_sample_size: number
  module_w?: number | null
  computed_at?: string
}

/** Raw fact_string row used as input to the engine */
export interface FactRow {
  string_id: string
  svg_id?: string | null
  inverter_id?: string | null
  tracker_id?: string | null
  dc_in?: number | null
  peer_group?: string | null
  poa: number | null
  t_mod?: number | null
  i_string: number | null
  v_string: number | null
  p_string: number | null
  module_w?: number | null
  ts: string // Fecha or ts_local
}

/** Result of computing p_expected for a single string */
export interface PExpectedResult {
  p_expected: number | null
  reference_method: ReferenceMethod
  reference_sample_size: number
}

/** Available timestamp with avg POA */
export interface AvailableTimestamp {
  ts: string
  avgPoa: number
  stringCount: number
}

/** Mirrors sunalize.daily_string_summary / public.daily_string_summary */
export interface DailyStringSummary {
  id?: string
  plant_id: string
  date: string // YYYY-MM-DD
  string_id: string
  svg_id: string | null
  inverter_id: string | null
  peer_group: string | null
  module_w: number | null
  p_string_avg: number | null
  p_expected_avg: number | null
  underperf_ratio: number | null
  underperf_delta_w: number | null
  class: AnalyticsClass
  reference_method: ReferenceMethod
  energy_loss_wh: number | null
  peak_intervals: number
  peak_poa_threshold: number | null
  avg_poa: number | null
}
