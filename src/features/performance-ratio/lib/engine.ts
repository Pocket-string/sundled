/**
 * Performance Ratio Engine — Pure functions for PR calculation.
 *
 * Replicates the LIAR 2.0 workbook logic as TypeScript functions.
 * No Supabase dependency. Receives data arrays, returns computed results.
 *
 * LIAR 2.0 formula chain (per interval):
 *   1. cleanIrradiance (dual pyranometer validation)
 *   2. isAboveThreshold (≥ 75 Wh/m²)
 *   3. specificProduction = production / peakPower
 *   4. rawPr = specProd / (irr × 0.001)  [fraction, not %]
 *   5. isAvailable = rawPr ≥ LPr (0.5)   [PR-threshold based]
 *   6. Lost energy: LAEO/LAEC = avgSpecProd_available × wpDown
 *   7. Lost irradiance: LAIO/LAIC = treatedIrr (per unavailable inverter)
 *   8. TAE = Production - LAEO - LAEC     [SUBTRACTION]
 *   9. TAI = EAI - LAIO - LAIC            [SUBTRACTION]
 *  10. PR_clean = Production / (EAI × sumCi × 0.001)  [raw PR, not TAE-based]
 *  11. Availability = TAI / EAI            [irradiance-based]
 *
 * Plant-level LAIC/LAIO are Wp-weighted per interval:
 *   LAIC_plant = treatedIrr × Σ(Wp_down_contractor) / sumCi
 */

import type { IrradianceMethod, Liability } from '../types'
import { MIN_IRR_THRESHOLD, LPR_THRESHOLD } from './constants'

// ---------------------------------------------------------------------------
// 1. Irradiance cleaning (dual pyranometer)
// ---------------------------------------------------------------------------

export interface CleanIrradianceResult {
  treated: number | null
  method: IrradianceMethod
}

/**
 * Validate and clean irradiance from 2 pyranometers.
 * LIAR 2.0 logic: PyrToll is used to deduct (flag) faulty sensors,
 * not to switch between avg/min. When both sensors remain valid,
 * the result is always the average.
 *
 * - Both valid → average (LIAR always averages when Nb pyra remain = 2)
 * - One valid → use it
 * - Neither valid → missing
 */
export function cleanIrradiance(
  pyro1: number | null,
  pyro2: number | null,
): CleanIrradianceResult {
  const p1Valid = pyro1 !== null && isFinite(pyro1) && pyro1 >= 0
  const p2Valid = pyro2 !== null && isFinite(pyro2) && pyro2 >= 0

  if (!p1Valid && !p2Valid) return { treated: null, method: 'missing' }
  if (p1Valid && !p2Valid) return { treated: pyro1!, method: 'single_pyro' }
  if (!p1Valid && p2Valid) return { treated: pyro2!, method: 'single_pyro' }

  return { treated: (pyro1! + pyro2!) / 2, method: 'avg_pyro' }
}

// ---------------------------------------------------------------------------
// 2. Threshold filter
// ---------------------------------------------------------------------------

/** Check if treated irradiance is above the minimum threshold for PR calc. */
export function isAboveThreshold(
  treatedIrr: number | null,
  minThreshold: number = MIN_IRR_THRESHOLD,
): boolean {
  return treatedIrr !== null && isFinite(treatedIrr) && treatedIrr >= minThreshold
}

// ---------------------------------------------------------------------------
// 3. Specific production
// ---------------------------------------------------------------------------

/** Specific production = energy / peak power (kWh/kWp). */
export function specificProduction(
  productionKwh: number | null,
  peakPowerKwp: number | null,
): number | null {
  if (productionKwh === null || peakPowerKwp === null) return null
  if (!isFinite(productionKwh) || !isFinite(peakPowerKwp)) return null
  if (peakPowerKwp <= 0) return null
  return productionKwh / peakPowerKwp
}

// ---------------------------------------------------------------------------
// 4. Raw PR per interval
// ---------------------------------------------------------------------------

/** Raw PR = specificProd / (irr × 0.001). Returns FRACTION (not %). */
export function rawPr(
  specProd: number | null,
  treatedIrrWhm2: number | null,
): number | null {
  if (specProd === null || treatedIrrWhm2 === null) return null
  if (!isFinite(specProd) || !isFinite(treatedIrrWhm2)) return null
  if (treatedIrrWhm2 <= 0) return null
  return specProd / (treatedIrrWhm2 * 0.001)
}

// ---------------------------------------------------------------------------
// 5. Availability detection (LIAR 2.0: PR-threshold based)
// ---------------------------------------------------------------------------

/**
 * LIAR 2.0 availability: an inverter is "available" if its raw PR >= LPr threshold.
 * ID[1/0] in LIAR: 0 = available, 1 = unavailable.
 *
 * - If irradiance below threshold → always available (not penalized)
 * - If PR >= LPr (default 0.5) → available
 * - If PR < LPr or no production → unavailable
 */
export function isAvailable(
  rawPrFraction: number | null,
  treatedIrr: number | null,
  minIrrThreshold: number = MIN_IRR_THRESHOLD,
  lPrThreshold: number = LPR_THRESHOLD,
): boolean {
  if (treatedIrr === null || treatedIrr < minIrrThreshold) return true
  if (rawPrFraction === null) return false
  return rawPrFraction >= lPrThreshold
}

// ---------------------------------------------------------------------------
// 6. Lost energy for unavailable inverter
// ---------------------------------------------------------------------------

/**
 * Compute lost energy when an inverter is down.
 * LIAR 2.0: LAEC/LAEO = actual production of the unavailable inverter.
 * This ensures TAE = Prod - LAEC - LAEO = production from available intervals only.
 */
export function computeLostEnergy(
  actualProductionKwh: number,
): number {
  return actualProductionKwh
}

/**
 * Compute lost irradiance when an inverter is down.
 * LAIO or LAIC = treatedIrr (per unavailable inverter)
 */
export function computeLostIrradiance(treatedIrrWhm2: number): number {
  return treatedIrrWhm2
}

// ---------------------------------------------------------------------------
// 7. TAE / TAI (LIAR 2.0: SUBTRACTION, not addition)
// ---------------------------------------------------------------------------

/** TAE = Production - LAEO - LAEC (LIAR 2.0 formula) */
export function totalAvailableEnergy(
  productionKwh: number,
  laeoKwh: number,
  laecKwh: number,
): number {
  return productionKwh - laeoKwh - laecKwh
}

/** TAI = EAI - LAIO - LAIC (LIAR 2.0 formula) */
export function totalAvailableIrradiation(
  eaiWhm2: number,
  laioWhm2: number,
  laicWhm2: number,
): number {
  return eaiWhm2 - laioWhm2 - laicWhm2
}

// ---------------------------------------------------------------------------
// 8. PR Clean (LIAR 2.0: uses raw production / (EAI × sumCi × 0.001))
// ---------------------------------------------------------------------------

/**
 * PR_clean = Production / (EAI × sumCi × 0.001)
 * Uses raw production and total irradiance (EAI). Returns FRACTION.
 * "Clean" refers to cleaned irradiance (dual pyranometer), NOT availability-adjusted.
 */
export function prClean(
  productionKwh: number,
  eaiWhm2: number,
  sumCiKwp: number,
): number | null {
  if (eaiWhm2 <= 0 || sumCiKwp <= 0) return null
  return productionKwh / (eaiWhm2 * sumCiKwp * 0.001)
}

// ---------------------------------------------------------------------------
// 9. Internal availability (LIAR 2.0: irradiance-based = TAI / EAI)
// ---------------------------------------------------------------------------

/** Internal availability = TAI / EAI (irradiance-based). Returns FRACTION. */
export function internalAvailability(
  taiWhm2: number,
  eaiWhm2: number,
): number | null {
  if (eaiWhm2 <= 0) return null
  return taiWhm2 / eaiWhm2
}

// ---------------------------------------------------------------------------
// Interval-level computation (orchestrates 1-9 for a single timestamp)
// ---------------------------------------------------------------------------

export interface InverterInterval {
  inverterId: string
  productionKwh: number | null        // Loss-factor-corrected production (for PR_clean, availability)
  rawProductionKwh: number | null      // Uncorrected production (for modified PR TAE)
  peakPowerKwp: number
}

export interface UnavailabilityLookup {
  start_ts: string
  end_ts: string
  inverter_id: string | null // null = whole plant
  liability: Liability
}

export interface IntervalResult {
  inverterId: string
  productionKwh: number              // Corrected production (for PR_clean)
  rawProductionKwh: number           // Uncorrected production (for modified PR TAE)
  peakPowerKwp: number
  specProd: number | null
  rawPrFraction: number | null
  available: boolean
  laeoKwh: number
  laecKwh: number
  laioWhm2: number
  laicWhm2: number
  liability: Liability | null
}

/**
 * Compute PR metrics for a single interval (1 timestamp, all inverters).
 * LIAR 2.0 logic: availability uses PR threshold (LPr), not just zero production.
 */
export function computeInterval(
  treatedIrrWhm2: number,
  inverters: InverterInterval[],
  events: UnavailabilityLookup[],
  fecha: string,
  minThreshold: number = MIN_IRR_THRESHOLD,
  lPrThreshold: number = LPR_THRESHOLD,
): IntervalResult[] {
  if (!isAboveThreshold(treatedIrrWhm2, minThreshold)) return []

  // Compute per-inverter metrics
  const results: IntervalResult[] = inverters.map(inv => {
    const sp = specificProduction(inv.productionKwh, inv.peakPowerKwp)
    const rp = rawPr(sp, treatedIrrWhm2)
    return {
      inverterId: inv.inverterId,
      productionKwh: inv.productionKwh ?? 0,
      rawProductionKwh: inv.rawProductionKwh ?? 0,
      peakPowerKwp: inv.peakPowerKwp,
      specProd: sp,
      rawPrFraction: rp,
      available: isAvailable(rp, treatedIrrWhm2, minThreshold, lPrThreshold),
      laeoKwh: 0,
      laecKwh: 0,
      laioWhm2: 0,
      laicWhm2: 0,
      liability: null,
    }
  })

  const available = results.filter(r => r.available)
  const unavailable = results.filter(r => !r.available)

  if (unavailable.length === 0) return results

  // Assign lost energy/irradiance to each unavailable inverter
  // LIAR 2.0: LAEC/LAEO = actual production of the unavailable inverter
  // LAIC/LAIO = treated irradiance for that interval
  for (const r of unavailable) {
    const liability = classifyLiability(fecha, r.inverterId, events)
    r.liability = liability

    const lostEnergy = computeLostEnergy(r.productionKwh)
    const lostIrr = computeLostIrradiance(treatedIrrWhm2)

    if (liability === 'operator') {
      r.laeoKwh = lostEnergy
      r.laioWhm2 = lostIrr
    } else {
      r.laecKwh = lostEnergy
      r.laicWhm2 = lostIrr
    }
  }

  return results
}

/**
 * Classify liability for a down inverter at a given timestamp.
 * Checks unavailability events; defaults to 'contractor' if no event found.
 */
function classifyLiability(
  fecha: string,
  inverterId: string,
  events: UnavailabilityLookup[],
): Liability {
  const matching = events.find(e =>
    fecha >= e.start_ts &&
    fecha <= e.end_ts &&
    (e.inverter_id === null || e.inverter_id === inverterId || e.inverter_id === 'ALL')
  )
  return matching?.liability ?? 'contractor'
}

// ---------------------------------------------------------------------------
// Daily aggregation
// ---------------------------------------------------------------------------

export interface DailyAggregation {
  date: string
  inverterId: string | null // null = plant total
  totalProductionKwh: number
  totalTreatedIrrWhm2: number // EAI for the day
  totalLaioWhm2: number
  totalLaicWhm2: number
  totalLaeoKwh: number
  totalLaecKwh: number
  taeKwh: number
  taiWhm2: number
  /** TAE using raw (uncorrected) production — for modified PR calculation */
  rawTaeKwh: number
  peakPowerKwp: number
  prCleanFraction: number | null
  availabilityFraction: number | null
  /** Modified PR: rawTAE / (TAI × Wp × 0.001). Uses uncorrected production per LIAR 2.0. */
  prCleanModifiedFraction: number | null
  /** Modified availability: always 1.0 when all losses are operator liability. */
  availabilityModifiedFraction: number | null
  validIntervals: number
}

/**
 * Aggregate interval results into a daily summary for a single inverter.
 */
export function aggregateDaily(
  date: string,
  inverterId: string,
  intervals: IntervalResult[],
  peakPowerKwp: number,
  treatedIrrPerInterval: number[],
): DailyAggregation {
  const invIntervals = intervals.filter(r => r.inverterId === inverterId)

  const totalProd = invIntervals.reduce((s, r) => s + r.productionKwh, 0)
  const eai = treatedIrrPerInterval.reduce((s, v) => s + v, 0)
  const totalLaio = invIntervals.reduce((s, r) => s + r.laioWhm2, 0)
  const totalLaic = invIntervals.reduce((s, r) => s + r.laicWhm2, 0)
  const totalLaeo = invIntervals.reduce((s, r) => s + r.laeoKwh, 0)
  const totalLaec = invIntervals.reduce((s, r) => s + r.laecKwh, 0)

  const tae = totalAvailableEnergy(totalProd, totalLaeo, totalLaec)
  const tai = totalAvailableIrradiation(eai, totalLaio, totalLaic)

  // Raw TAE: sum of uncorrected production from available intervals only
  // LIAR 2.0 uses raw (pre-loss-factor) production for per-inverter modified PR
  const rawTae = invIntervals
    .filter(r => r.available)
    .reduce((s, r) => s + r.rawProductionKwh, 0)

  return {
    date,
    inverterId,
    totalProductionKwh: totalProd,
    totalTreatedIrrWhm2: eai,
    totalLaioWhm2: totalLaio,
    totalLaicWhm2: totalLaic,
    totalLaeoKwh: totalLaeo,
    totalLaecKwh: totalLaec,
    taeKwh: tae,
    taiWhm2: tai,
    rawTaeKwh: rawTae,
    peakPowerKwp,
    prCleanFraction: prClean(totalProd, eai, peakPowerKwp),
    availabilityFraction: eai > 0 ? tai / eai : null,
    // Modified PR uses raw (uncorrected) production per LIAR 2.0
    prCleanModifiedFraction: tai > 0 ? prClean(rawTae, tai, peakPowerKwp) : null,
    availabilityModifiedFraction: tai > 0 ? 1.0 : null,
    validIntervals: invIntervals.length,
  }
}

/**
 * Aggregate interval results into a daily plant-level summary.
 * Plant-level LAIC/LAIO are Wp-weighted per interval, not summed across inverters.
 */
export function aggregateDailyPlant(
  date: string,
  allIntervals: IntervalResult[],
  sumCiKwp: number,
  treatedIrrPerInterval: number[],
  intervalsPerTimestamp: IntervalResult[][],
): DailyAggregation {
  const totalProd = allIntervals.reduce((s, r) => s + r.productionKwh, 0)
  const eai = treatedIrrPerInterval.reduce((s, v) => s + v, 0)

  // Plant-level LAIO/LAIC: Wp-weighted per interval
  // LAIC_plant_interval = treatedIrr × Σ(Wp_down_contractor) / sumCi
  let plantLaio = 0
  let plantLaic = 0
  let plantLaeo = 0
  let plantLaec = 0

  for (let i = 0; i < intervalsPerTimestamp.length; i++) {
    const irrVal = treatedIrrPerInterval[i]
    const intervalResults = intervalsPerTimestamp[i]

    let wpDownOperator = 0
    let wpDownContractor = 0
    let intervalLaeo = 0
    let intervalLaec = 0

    for (const r of intervalResults) {
      if (!r.available) {
        if (r.liability === 'operator') {
          wpDownOperator += r.peakPowerKwp
          intervalLaeo += r.laeoKwh
        } else {
          wpDownContractor += r.peakPowerKwp
          intervalLaec += r.laecKwh
        }
      }
    }

    // Wp-weighted irradiance losses at plant level
    if (sumCiKwp > 0) {
      plantLaio += irrVal * (wpDownOperator / sumCiKwp)
      plantLaic += irrVal * (wpDownContractor / sumCiKwp)
    }
    plantLaeo += intervalLaeo
    plantLaec += intervalLaec
  }

  const tae = totalAvailableEnergy(totalProd, plantLaeo, plantLaec)
  const tai = totalAvailableIrradiation(eai, plantLaio, plantLaic)

  // Plant-level rawTae not used directly for modified PR (Wp-weighted avg is used instead)
  // but we store it for completeness
  const rawTae = allIntervals
    .filter(r => r.available)
    .reduce((s, r) => s + r.rawProductionKwh, 0)

  return {
    date,
    inverterId: null,
    totalProductionKwh: totalProd,
    totalTreatedIrrWhm2: eai,
    totalLaioWhm2: plantLaio,
    totalLaicWhm2: plantLaic,
    totalLaeoKwh: plantLaeo,
    totalLaecKwh: plantLaec,
    taeKwh: tae,
    taiWhm2: tai,
    rawTaeKwh: rawTae,
    peakPowerKwp: sumCiKwp,
    prCleanFraction: prClean(totalProd, eai, sumCiKwp),
    availabilityFraction: eai > 0 ? tai / eai : null,
    // Plant-level modified PR computed later via Wp-weighted avg of per-inverter values
    prCleanModifiedFraction: tai > 0 ? prClean(tae, tai, sumCiKwp) : null,
    availabilityModifiedFraction: tai > 0 ? 1.0 : null,
    validIntervals: treatedIrrPerInterval.length,
  }
}
