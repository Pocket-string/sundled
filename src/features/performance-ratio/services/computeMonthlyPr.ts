/**
 * PR Computation Orchestrator
 *
 * Reads raw data from fact tables (day by day to respect PostgREST 1000-row limit),
 * runs the LIAR 2.0 engine interval-by-interval in memory, and writes daily/monthly summaries.
 */

import { createSunalizeClient } from '@/lib/supabase/server'
import {
  computeInterval,
  aggregateDaily,
  aggregateDailyPlant,
  prClean,
  totalAvailableEnergy,
  totalAvailableIrradiation,
  internalAvailability,
} from '../lib/engine'
import type { InverterInterval, UnavailabilityLookup, IntervalResult, DailyAggregation } from '../lib/engine'
import type { DimInverter, DailyPrSummary, MonthlyPrSummary } from '../types'
import { MIN_IRR_THRESHOLD, GUARANTEED_PR, GUARANTEED_AVAILABILITY } from '../lib/constants'

const BATCH_SIZE = 200

interface ComputeResult {
  month: string
  daysProcessed: number
  dailySummaries: number
  monthlySummaries: number
  plantPrClean: number | null
  plantAvailability: number | null
  plantPrCleanModified: number | null
  plantAvailabilityModified: number | null
}

/**
 * Compute PR for a given plant and month.
 * Reads raw fact data day-by-day, runs engine, writes daily + monthly summaries.
 */
export async function computeMonthlyPr(
  plantId: string,
  month: string, // "YYYY-MM"
  dryRun: boolean = false,
): Promise<ComputeResult> {
  const supabase = createSunalizeClient()

  // Load dim_inverters
  const { data: invertersRaw, error: invErr } = await supabase
    .from('dim_inverters')
    .select('plant_id, inverter_id, ct_id, peak_power_kwp')
    .eq('plant_id', plantId)

  if (invErr || !invertersRaw || invertersRaw.length === 0) {
    throw new Error(`No inverters found for ${plantId}: ${invErr?.message}`)
  }

  const dimInverters: DimInverter[] = invertersRaw
  const sumCiKwp = dimInverters.reduce((sum, inv) => sum + inv.peak_power_kwp, 0)

  // Load unavailability events for this month
  const monthStart = `${month}-01 00:00:00`
  const monthEnd = `${month}-31 23:59:59`
  const { data: eventsRaw } = await supabase
    .from('pr_unavailability_events')
    .select('start_ts, end_ts, inverter_id, liability')
    .eq('plant_id', plantId)
    .gte('end_ts', monthStart)
    .lte('start_ts', monthEnd)

  const events: UnavailabilityLookup[] = (eventsRaw ?? []).map(e => ({
    start_ts: e.start_ts,
    end_ts: e.end_ts,
    inverter_id: e.inverter_id,
    liability: e.liability,
  }))

  // Generate dates for the month
  const dates = generateMonthDates(month)

  // Process day by day
  const allDailySummaries: DailyPrSummary[] = []
  let daysProcessed = 0

  for (const date of dates) {
    const dayResults = await processDay(supabase, plantId, date, dimInverters, events)
    if (!dayResults) continue

    daysProcessed++
    const { allIntervalResults, treatedIrrValues, intervalsPerTimestamp } = dayResults

    // Per-inverter daily aggregation
    for (const inv of dimInverters) {
      const agg = aggregateDaily(date, inv.inverter_id, allIntervalResults, inv.peak_power_kwp, treatedIrrValues)
      allDailySummaries.push(aggToDailySummary(plantId, agg))
    }

    // Plant-level daily aggregation (Wp-weighted LAIC/LAIO)
    const plantAgg = aggregateDailyPlant(date, allIntervalResults, sumCiKwp, treatedIrrValues, intervalsPerTimestamp)
    allDailySummaries.push(aggToDailySummary(plantId, plantAgg))
  }

  // Compute monthly aggregation from daily summaries
  const monthlySummaries = buildMonthlySummaries(plantId, month, allDailySummaries, sumCiKwp)

  // Get plant-level monthly result
  const plantMonthly = monthlySummaries.find(s => s.inverter_id === null)

  if (!dryRun) {
    // Delete existing summaries for this plant/month, then insert fresh
    await supabase
      .from('daily_pr_summary')
      .delete()
      .eq('plant_id', plantId)
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`)

    await supabase
      .from('monthly_pr_summary')
      .delete()
      .eq('plant_id', plantId)
      .eq('month', month)

    await batchInsert(supabase, 'daily_pr_summary', allDailySummaries)
    await batchInsert(supabase, 'monthly_pr_summary', monthlySummaries)
  }

  return {
    month,
    daysProcessed,
    dailySummaries: allDailySummaries.length,
    monthlySummaries: monthlySummaries.length,
    plantPrClean: plantMonthly?.pr_clean_pct ?? null,
    plantAvailability: plantMonthly?.internal_availability_pct ?? null,
    plantPrCleanModified: plantMonthly?.pr_clean_modified_pct ?? null,
    plantAvailabilityModified: plantMonthly?.availability_modified_pct ?? null,
  }
}

// ---------------------------------------------------------------------------
// Process a single day: fetch raw data, run engine
// ---------------------------------------------------------------------------

interface DayResult {
  allIntervalResults: IntervalResult[]
  treatedIrrValues: number[]
  intervalsPerTimestamp: IntervalResult[][] // needed for Wp-weighted plant aggregation
}

async function processDay(
  supabase: ReturnType<typeof createSunalizeClient>,
  plantId: string,
  date: string,
  inverters: DimInverter[],
  events: UnavailabilityLookup[],
): Promise<DayResult | null> {
  const dayStart = `${date} 00:00:00`
  const dayEnd = `${date} 23:59:59`

  const { data: irrRows, error: irrErr } = await supabase
    .from('fact_irradiance')
    .select('Fecha, treated_irr_whm2, above_threshold')
    .eq('plant_id', plantId)
    .gte('Fecha', dayStart)
    .lte('Fecha', dayEnd)
    .order('Fecha')

  if (irrErr || !irrRows || irrRows.length === 0) return null

  // Fetch inverter production (exclude all meters)
  const { data: prodRows, error: prodErr } = await supabase
    .from('fact_inverter_production')
    .select('Fecha, inverter_id, production_kwh')
    .eq('plant_id', plantId)
    .gte('Fecha', dayStart)
    .lte('Fecha', dayEnd)
    .not('inverter_id', 'like', 'METER_%')

  if (prodErr) {
    throw new Error(`Error fetching production for ${date}: ${prodErr.message}`)
  }

  // Fetch PMGD meter data for loss factor correction
  const { data: meterRows } = await supabase
    .from('fact_inverter_production')
    .select('Fecha, production_kwh')
    .eq('plant_id', plantId)
    .eq('inverter_id', 'METER_PMGD')
    .gte('Fecha', dayStart)
    .lte('Fecha', dayEnd)

  const meterMap = new Map<string, number>()
  for (const row of (meterRows ?? [])) {
    if (row.production_kwh !== null) {
      meterMap.set(row.Fecha, row.production_kwh)
    }
  }

  // Build raw production map and per-timestamp sums for loss factor
  const rawProdMap = new Map<string, number | null>()
  const rawSumPerTs = new Map<string, number>()
  for (const row of (prodRows ?? [])) {
    rawProdMap.set(`${row.Fecha}|${row.inverter_id}`, row.production_kwh)
    if (row.production_kwh !== null && row.production_kwh > 0) {
      rawSumPerTs.set(row.Fecha, (rawSumPerTs.get(row.Fecha) ?? 0) + row.production_kwh)
    }
  }

  // Apply loss factor: corrected_prod = raw_prod × (meter / sum_raw)
  const prodMap = new Map<string, number | null>()
  const rawProdLookup = new Map<string, number | null>()
  for (const row of (prodRows ?? [])) {
    const key = `${row.Fecha}|${row.inverter_id}`
    const rawProd = row.production_kwh
    rawProdLookup.set(key, rawProd)

    const meterKwh = meterMap.get(row.Fecha)
    const rawSum = rawSumPerTs.get(row.Fecha)

    if (rawProd !== null && meterKwh !== undefined && rawSum && rawSum > 0) {
      const lossFactor = meterKwh / rawSum
      prodMap.set(key, rawProd * lossFactor)
    } else {
      prodMap.set(key, rawProd)
    }
  }

  const allResults: IntervalResult[] = []
  const treatedIrrValues: number[] = []
  const intervalsPerTimestamp: IntervalResult[][] = []

  for (const irrRow of irrRows) {
    const treatedIrr = irrRow.treated_irr_whm2
    if (treatedIrr === null || treatedIrr < MIN_IRR_THRESHOLD) continue

    treatedIrrValues.push(treatedIrr)

    const invIntervals: InverterInterval[] = inverters.map(inv => ({
      inverterId: inv.inverter_id,
      productionKwh: prodMap.get(`${irrRow.Fecha}|${inv.inverter_id}`) ?? null,
      rawProductionKwh: rawProdLookup.get(`${irrRow.Fecha}|${inv.inverter_id}`) ?? null,
      peakPowerKwp: inv.peak_power_kwp,
    }))

    const results = computeInterval(treatedIrr, invIntervals, events, irrRow.Fecha)
    allResults.push(...results)
    intervalsPerTimestamp.push(results)
  }

  if (allResults.length === 0) return null

  return { allIntervalResults: allResults, treatedIrrValues, intervalsPerTimestamp }
}

// ---------------------------------------------------------------------------
// Monthly aggregation from daily summaries
// ---------------------------------------------------------------------------

function buildMonthlySummaries(
  plantId: string,
  month: string,
  dailySummaries: DailyPrSummary[],
  sumCiKwp: number,
): MonthlyPrSummary[] {
  const groups = new Map<string | null, DailyPrSummary[]>()
  for (const ds of dailySummaries) {
    const key = ds.inverter_id
    const arr = groups.get(key) ?? []
    arr.push(ds)
    groups.set(key, arr)
  }

  const meterProd: number | null = null
  const monthlies: MonthlyPrSummary[] = []

  // First pass: compute per-inverter monthly summaries
  for (const [inverterId, days] of groups) {
    if (inverterId === null) continue // plant-level computed after

    const totalProd = days.reduce((s, d) => s + (d.total_production_kwh ?? 0), 0)
    const eai = days.reduce((s, d) => s + (d.total_treated_irr_whm2 ?? 0), 0)
    const totalLaio = days.reduce((s, d) => s + d.total_laio_whm2, 0)
    const totalLaic = days.reduce((s, d) => s + d.total_laic_whm2, 0)
    const totalLaeo = days.reduce((s, d) => s + d.total_laeo_kwh, 0)
    const totalLaec = days.reduce((s, d) => s + d.total_laec_kwh, 0)

    const tae = totalAvailableEnergy(totalProd, totalLaeo, totalLaec)
    const tai = totalAvailableIrradiation(eai, totalLaio, totalLaic)
    const wp = days[0]?.peak_power_kwp ?? 0

    // Raw TAE: sum of uncorrected production from available intervals
    // LIAR 2.0 uses raw production for per-inverter modified PR
    const rawTae = days.reduce((s, d) => s + (d.raw_tae_kwh ?? 0), 0)

    monthlies.push({
      plant_id: plantId,
      month,
      inverter_id: inverterId,
      total_production_kwh: totalProd,
      total_treated_irr_whm2: eai,
      total_laio_whm2: totalLaio,
      total_laic_whm2: totalLaic,
      total_laeo_kwh: totalLaeo,
      total_laec_kwh: totalLaec,
      tae_kwh: tae,
      tai_whm2: tai,
      peak_power_kwp: wp,
      pr_clean_pct: prClean(totalProd, eai, wp),
      internal_availability_pct: internalAvailability(tai, eai),
      // Per-inverter modified PR: rawTAE / (TAI × Wp × 0.001)
      // Uses raw (uncorrected) production per LIAR 2.0 methodology
      pr_clean_modified_pct: tai > 0 ? prClean(rawTae, tai, wp) : null,
      availability_modified_pct: tai > 0 ? 1.0 : null,
      guaranteed_pr_pct: GUARANTEED_PR,
      guaranteed_availability_pct: GUARANTEED_AVAILABILITY,
      meter_production_kwh: null,
      sum_ci_kwp: null,
      min_irr_threshold: MIN_IRR_THRESHOLD,
    })
  }

  // Second pass: plant-level monthly summary
  const plantDays = groups.get(null)
  if (plantDays) {
    const totalProd = plantDays.reduce((s, d) => s + (d.total_production_kwh ?? 0), 0)
    const eai = plantDays.reduce((s, d) => s + (d.total_treated_irr_whm2 ?? 0), 0)
    const totalLaio = plantDays.reduce((s, d) => s + d.total_laio_whm2, 0)
    const totalLaic = plantDays.reduce((s, d) => s + d.total_laic_whm2, 0)
    const totalLaeo = plantDays.reduce((s, d) => s + d.total_laeo_kwh, 0)
    const totalLaec = plantDays.reduce((s, d) => s + d.total_laec_kwh, 0)

    const tae = totalAvailableEnergy(totalProd, totalLaeo, totalLaec)
    const tai = totalAvailableIrradiation(eai, totalLaio, totalLaic)

    // Plant modified PR = Wp-weighted average of per-inverter modified PR
    const invMonthlies = monthlies.filter(m => m.inverter_id !== null)
    let sumPrModWp = 0
    let sumWp = 0
    for (const inv of invMonthlies) {
      const wp = inv.peak_power_kwp ?? 0
      const prMod = inv.pr_clean_modified_pct
      if (prMod !== null && wp > 0) {
        sumPrModWp += prMod * wp
        sumWp += wp
      }
    }
    const plantPrCleanModified = sumWp > 0 ? sumPrModWp / sumWp : null

    monthlies.push({
      plant_id: plantId,
      month,
      inverter_id: null,
      total_production_kwh: totalProd,
      total_treated_irr_whm2: eai,
      total_laio_whm2: totalLaio,
      total_laic_whm2: totalLaic,
      total_laeo_kwh: totalLaeo,
      total_laec_kwh: totalLaec,
      tae_kwh: tae,
      tai_whm2: tai,
      peak_power_kwp: sumCiKwp,
      // LIAR 2.0: PR_clean = Prod / (EAI × Wp × 0.001)
      pr_clean_pct: prClean(totalProd, eai, sumCiKwp),
      // LIAR 2.0: Availability = TAI / EAI
      internal_availability_pct: internalAvailability(tai, eai),
      // Plant modified PR: Wp-weighted average of per-inverter modified PR
      pr_clean_modified_pct: plantPrCleanModified,
      // Modified availability: 1.0 (all losses reclassified as operator)
      availability_modified_pct: tai > 0 ? 1.0 : null,
      guaranteed_pr_pct: GUARANTEED_PR,
      guaranteed_availability_pct: GUARANTEED_AVAILABILITY,
      meter_production_kwh: meterProd,
      sum_ci_kwp: sumCiKwp,
      min_irr_threshold: MIN_IRR_THRESHOLD,
    })
  }

  return monthlies
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function aggToDailySummary(plantId: string, agg: DailyAggregation): DailyPrSummary {
  return {
    plant_id: plantId,
    date: agg.date,
    inverter_id: agg.inverterId,
    total_production_kwh: agg.totalProductionKwh,
    total_treated_irr_whm2: agg.totalTreatedIrrWhm2,
    total_laio_whm2: agg.totalLaioWhm2,
    total_laic_whm2: agg.totalLaicWhm2,
    total_laeo_kwh: agg.totalLaeoKwh,
    total_laec_kwh: agg.totalLaecKwh,
    tae_kwh: agg.taeKwh,
    tai_whm2: agg.taiWhm2,
    raw_tae_kwh: agg.rawTaeKwh,
    peak_power_kwp: agg.peakPowerKwp,
    daily_pr_pct: agg.prCleanFraction,
    availability_pct: agg.availabilityFraction,
    daily_pr_modified_pct: agg.prCleanModifiedFraction,
    availability_modified_pct: agg.availabilityModifiedFraction,
    valid_intervals: agg.validIntervals,
  }
}

async function batchInsert(
  supabase: ReturnType<typeof createSunalizeClient>,
  table: string,
  rows: unknown[],
) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from(table)
      .insert(batch as Record<string, unknown>[])

    if (error) {
      throw new Error(`Insert error on ${table} at batch ${i}: ${error.message}`)
    }
  }
}

function generateMonthDates(month: string): string[] {
  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const dates: string[] = []

  for (let d = 1; d <= daysInMonth; d++) {
    const dd = String(d).padStart(2, '0')
    const mm = String(mon).padStart(2, '0')
    dates.push(`${year}-${mm}-${dd}`)
  }

  return dates
}
