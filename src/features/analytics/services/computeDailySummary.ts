import { createSunalizeClient } from '@/lib/supabase/server'
import type { DailyStringSummary } from '../types'
import { getAnalyticsSnapshotDemo } from './getAnalyticsSnapshot'

const INTERVAL_HOURS = 0.5 // 30-minute intervals

/**
 * Compute and persist daily string summaries for a given plant and date.
 *
 * Reuses the existing peak_energy analysis (getAnalyticsSnapshotDemo),
 * then calculates energy_loss_wh and upserts into daily_string_summary.
 *
 * energy_loss_wh = max(p_expected - p_string, 0) × 0.5h × peak_intervals
 * (using per-interval delta already computed as underperf_delta_w)
 */
export async function computeAndStoreDailySummaryDemo(
  plantId: string,
  date: string
): Promise<{ inserted: number; date: string }> {
  // Step 1: Run the existing peak_energy analysis
  const result = await getAnalyticsSnapshotDemo(plantId, date)

  if (result.snapshots.length === 0) {
    return { inserted: 0, date }
  }

  const peakIntervals = result.windowIntervals ?? 0
  const poaThreshold = result.peakPoaThreshold ?? null

  // Step 2: Build summary rows with energy_loss_wh
  const summaries: DailyStringSummary[] = result.snapshots.map((s) => {
    // Energy loss: delta_w is avg deficit per interval
    // Total loss = delta_w × peak_intervals × 0.5h (each interval is 30 min)
    const energyLossWh =
      s.underperf_delta_w !== null && s.underperf_delta_w > 0 && peakIntervals > 0
        ? s.underperf_delta_w * peakIntervals * INTERVAL_HOURS
        : 0

    return {
      plant_id: plantId,
      date,
      string_id: s.string_id,
      svg_id: s.svg_id,
      inverter_id: s.inverter_id,
      peer_group: s.peer_group,
      module_w: s.module_w ?? null,
      p_string_avg: s.p_string,
      p_expected_avg: s.p_expected,
      underperf_ratio: s.underperf_ratio,
      underperf_delta_w: s.underperf_delta_w,
      class: s.class,
      reference_method: s.reference_method,
      energy_loss_wh: energyLossWh,
      peak_intervals: peakIntervals,
      peak_poa_threshold: poaThreshold,
      avg_poa: s.poa,
    }
  })

  // Step 3: Upsert into daily_string_summary in batches
  const supabase = createSunalizeClient()
  const BATCH_SIZE = 200
  let inserted = 0

  for (let i = 0; i < summaries.length; i += BATCH_SIZE) {
    const batch = summaries.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('daily_string_summary')
      .upsert(
        batch.map((s) => ({
          plant_id: s.plant_id,
          date: s.date,
          string_id: s.string_id,
          svg_id: s.svg_id,
          inverter_id: s.inverter_id,
          peer_group: s.peer_group,
          module_w: s.module_w,
          p_string_avg: s.p_string_avg,
          p_expected_avg: s.p_expected_avg,
          underperf_ratio: s.underperf_ratio,
          underperf_delta_w: s.underperf_delta_w,
          class: s.class,
          reference_method: s.reference_method,
          energy_loss_wh: s.energy_loss_wh,
          peak_intervals: s.peak_intervals,
          peak_poa_threshold: s.peak_poa_threshold,
          avg_poa: s.avg_poa,
          computed_at: new Date().toISOString(),
        })),
        { onConflict: 'plant_id,date,string_id' }
      )

    if (error) {
      console.error(`[computeDailySummary] Batch ${i}–${i + batch.length} error:`, error.message)
    } else {
      inserted += batch.length
    }
  }

  return { inserted, date }
}

/**
 * Backfill daily summaries for a range of dates.
 * Processes one date at a time to avoid memory issues.
 */
export async function backfillDailySummariesDemo(
  plantId: string,
  dates: string[]
): Promise<{ total: number; processed: string[] }> {
  let total = 0
  const processed: string[] = []

  for (const date of dates) {
    const result = await computeAndStoreDailySummaryDemo(plantId, date)
    if (result.inserted > 0) {
      total += result.inserted
      processed.push(date)
    }
  }

  return { total, processed }
}
