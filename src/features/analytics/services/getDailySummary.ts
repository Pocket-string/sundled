import { createSunalizeClient } from '@/lib/supabase/server'
import type { DailyStringSummary, AnalyticsClass } from '../types'

/**
 * Get daily summaries for a single string over a date range.
 * Used for: trend charts, "since when", cumulative loss.
 */
export async function getStringDailySummariesDemo(
  plantId: string,
  stringId: string,
  limit: number = 90
): Promise<DailyStringSummary[]> {
  const supabase = createSunalizeClient()

  const { data, error } = await supabase
    .from('daily_string_summary')
    .select('*')
    .eq('plant_id', plantId)
    .eq('string_id', stringId)
    .order('date', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[getStringDailySummaries]', error.message)
    return []
  }

  return (data ?? []).map(mapRow)
}

/**
 * Get loss statistics for a string: since when, cumulative loss, avg $/day.
 */
export interface StringLossStats {
  /** First date the string was classified as orange or red */
  underperformingSince: string | null
  /** Number of consecutive days currently underperforming */
  consecutiveDays: number
  /** Total energy lost across all underperforming days (Wh) */
  totalEnergyLossWh: number
  /** Total number of underperforming days */
  totalUnderperformingDays: number
  /** Average daily energy loss (Wh) */
  avgDailyLossWh: number
  /** Current class */
  currentClass: AnalyticsClass | null
  /** Most recent ratio */
  currentRatio: number | null
  /** Total days with data */
  totalDaysWithData: number
}

export async function getStringLossStatsDemo(
  plantId: string,
  stringId: string
): Promise<StringLossStats> {
  const summaries = await getStringDailySummariesDemo(plantId, stringId, 365)

  const empty: StringLossStats = {
    underperformingSince: null,
    consecutiveDays: 0,
    totalEnergyLossWh: 0,
    totalUnderperformingDays: 0,
    avgDailyLossWh: 0,
    currentClass: null,
    currentRatio: null,
    totalDaysWithData: 0,
  }

  if (summaries.length === 0) return empty

  // Total loss across all days
  let totalLoss = 0
  let underperformingDays = 0
  let firstUnderperformingDate: string | null = null

  for (const s of summaries) {
    if (s.energy_loss_wh !== null && s.energy_loss_wh > 0) {
      totalLoss += s.energy_loss_wh
    }
    if (s.class === 'orange' || s.class === 'red') {
      underperformingDays++
      if (!firstUnderperformingDate) {
        firstUnderperformingDate = s.date
      }
    }
  }

  // Count consecutive underperforming days from the end (most recent)
  let consecutiveDays = 0
  for (let i = summaries.length - 1; i >= 0; i--) {
    const c = summaries[i].class
    if (c === 'orange' || c === 'red') {
      consecutiveDays++
    } else {
      break
    }
  }

  const latest = summaries[summaries.length - 1]

  return {
    underperformingSince: consecutiveDays > 0
      ? summaries[summaries.length - consecutiveDays]?.date ?? null
      : null,
    consecutiveDays,
    totalEnergyLossWh: Math.round(totalLoss),
    totalUnderperformingDays: underperformingDays,
    avgDailyLossWh: underperformingDays > 0
      ? Math.round(totalLoss / underperformingDays)
      : 0,
    currentClass: latest.class,
    currentRatio: latest.underperf_ratio,
    totalDaysWithData: summaries.length,
  }
}

/**
 * Get plant-wide loss summary for a date range.
 * Aggregates losses across all strings.
 */
export interface PlantLossSummary {
  /** Total energy lost across all strings (kWh) */
  totalLossKwh: number
  /** Number of strings currently underperforming (orange + red) */
  stringsUnderperforming: number
  /** Average loss per underperforming string per day (Wh) */
  avgLossPerStringWh: number
  /** Date range covered */
  dateStart: string | null
  dateEnd: string | null
  /** Total days analyzed */
  daysAnalyzed: number
}

export async function getPlantLossSummaryDemo(
  plantId: string,
  days: number = 30
): Promise<PlantLossSummary> {
  const supabase = createSunalizeClient()

  const { data, error } = await supabase
    .from('daily_string_summary')
    .select('date, string_id, class, energy_loss_wh')
    .eq('plant_id', plantId)
    .order('date', { ascending: false })
    .limit(days * 700) // ~700 strings × N days

  if (error || !data || data.length === 0) {
    return {
      totalLossKwh: 0,
      stringsUnderperforming: 0,
      avgLossPerStringWh: 0,
      dateStart: null,
      dateEnd: null,
      daysAnalyzed: 0,
    }
  }

  let totalLoss = 0
  const dates = new Set<string>()
  const latestDate = String(data[0].date)
  const underperformingStrings = new Set<string>()

  for (const row of data) {
    const loss = Number(row.energy_loss_wh)
    if (!isNaN(loss) && loss > 0) totalLoss += loss
    dates.add(String(row.date))

    // Count strings underperforming on the latest date
    if (String(row.date) === latestDate && (row.class === 'orange' || row.class === 'red')) {
      underperformingStrings.add(row.string_id)
    }
  }

  const daysAnalyzed = dates.size
  const sortedDates = Array.from(dates).sort()

  return {
    totalLossKwh: Math.round(totalLoss / 10) / 100, // Wh to kWh, 2 decimals
    stringsUnderperforming: underperformingStrings.size,
    avgLossPerStringWh: underperformingStrings.size > 0
      ? Math.round(totalLoss / underperformingStrings.size / daysAnalyzed)
      : 0,
    dateStart: sortedDates[0] ?? null,
    dateEnd: sortedDates[sortedDates.length - 1] ?? null,
    daysAnalyzed,
  }
}

function mapRow(row: Record<string, unknown>): DailyStringSummary {
  return {
    plant_id: String(row.plant_id),
    date: String(row.date),
    string_id: String(row.string_id),
    svg_id: row.svg_id as string | null,
    inverter_id: row.inverter_id as string | null,
    peer_group: row.peer_group as string | null,
    module_w: row.module_w as number | null,
    p_string_avg: row.p_string_avg as number | null,
    p_expected_avg: row.p_expected_avg as number | null,
    underperf_ratio: row.underperf_ratio as number | null,
    underperf_delta_w: row.underperf_delta_w as number | null,
    class: row.class as DailyStringSummary['class'],
    reference_method: row.reference_method as DailyStringSummary['reference_method'],
    energy_loss_wh: row.energy_loss_wh as number | null,
    peak_intervals: (row.peak_intervals as number) ?? 0,
    peak_poa_threshold: row.peak_poa_threshold as number | null,
    avg_poa: row.avg_poa as number | null,
  }
}
