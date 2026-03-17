/**
 * Performance Ratio module types.
 *
 * Mirrors the LIAR 2.0 workbook data model:
 * - Raw interval data (irradiance + production)
 * - Cleaned/validated irradiance
 * - Daily and monthly PR summaries
 * - Unavailability events with liability classification
 */

// ---------------------------------------------------------------------------
// Irradiance
// ---------------------------------------------------------------------------

/** Validation method used to produce treated irradiance */
export type IrradianceMethod =
  | 'avg_pyro'      // Both pyranometers agree within tolerance → average
  | 'single_pyro'   // Only one pyranometer available → use it
  | 'min_pyro'      // Pyranometers disagree > tolerance → use the lower (conservative)
  | 'sgis_backup'   // SolarGIS fallback (not available for Angamos)
  | 'missing'       // No valid source

/** Parsed row from Sonnedix 3 (irradiance CSV) */
export interface IrradianceRawRow {
  fecha: string                    // Normalized "YYYY-MM-DD HH:MM:00"
  pyranometer1Whm2: number | null  // POA1_UP (W/m2, but ≡ Wh/m2 for 1h intervals)
  pyranometer2Whm2: number | null  // POA2_UP
}

/** Irradiance row after dual-sensor validation */
export interface IrradianceCleanRow {
  fecha: string
  pyranometer1Whm2: number | null
  pyranometer2Whm2: number | null
  treatedIrrWhm2: number | null
  validationMethod: IrradianceMethod
  aboveThreshold: boolean          // treated >= minIrrThreshold (default 75)
}

// ---------------------------------------------------------------------------
// Production
// ---------------------------------------------------------------------------

/** Parsed row from Sonnedix 1 (inverter production CSV) — one row per inverter per timestamp */
export interface InverterProductionRow {
  fecha: string                    // Normalized "YYYY-MM-DD HH:MM:00"
  inverterId: string               // "INV 1-1", "INV 3-14", etc.
  productionKwh: number | null     // Energy exported in the interval (kWh)
}

/** Parsed row from Sonnedix 2 (meter CSV) */
export interface MeterRow {
  fecha: string
  meterId: string                  // "ION7400" or "ION8650"
  exportedKwh: number | null
  importedKwh: number | null
}

// ---------------------------------------------------------------------------
// Fact table rows (ready for DB upsert)
// ---------------------------------------------------------------------------

/** Row for sunalize.fact_irradiance */
export interface FactIrradianceRow {
  plant_id: string
  Fecha: string                    // "YYYY-MM-DD HH:MM:00"
  pyranometer_1_whm2: number | null
  pyranometer_2_whm2: number | null
  solargis_whm2: number | null
  treated_irr_whm2: number | null
  validation_method: IrradianceMethod
  above_threshold: boolean
}

/** Row for sunalize.fact_inverter_production */
export interface FactInverterProductionRow {
  plant_id: string
  Fecha: string
  inverter_id: string              // "INV 1-1" or "METER_ION7400"
  production_kwh: number | null
  peak_power_kwp: number | null    // From dim_inverters lookup
}

// ---------------------------------------------------------------------------
// Dim tables
// ---------------------------------------------------------------------------

/** Row from sunalize.dim_inverters */
export interface DimInverter {
  plant_id: string
  inverter_id: string              // "INV 1-1"
  ct_id: string                    // "CT1"
  peak_power_kwp: number
}

// ---------------------------------------------------------------------------
// Unavailability events
// ---------------------------------------------------------------------------

export type Liability = 'contractor' | 'operator'

export interface UnavailabilityEvent {
  plant_id: string
  start_ts: string
  end_ts: string
  inverter_id: string | null       // null = whole plant
  liability: Liability
  description: string | null
}

// ---------------------------------------------------------------------------
// Summary tables
// ---------------------------------------------------------------------------

export interface DailyPrSummary {
  plant_id: string
  date: string                     // "YYYY-MM-DD"
  inverter_id: string | null       // null = plant total
  total_production_kwh: number | null
  total_treated_irr_whm2: number | null
  total_laio_whm2: number
  total_laic_whm2: number
  total_laeo_kwh: number
  total_laec_kwh: number
  tae_kwh: number | null
  tai_whm2: number | null
  /** TAE using raw (uncorrected) production — for modified PR */
  raw_tae_kwh: number | null
  peak_power_kwp: number | null
  daily_pr_pct: number | null
  availability_pct: number | null
  daily_pr_modified_pct: number | null
  availability_modified_pct: number | null
  valid_intervals: number
}

export interface MonthlyPrSummary {
  plant_id: string
  month: string                    // "YYYY-MM"
  inverter_id: string | null
  total_production_kwh: number | null
  total_treated_irr_whm2: number | null
  total_laio_whm2: number
  total_laic_whm2: number
  total_laeo_kwh: number
  total_laec_kwh: number
  tae_kwh: number | null
  tai_whm2: number | null
  peak_power_kwp: number | null
  pr_clean_pct: number | null
  internal_availability_pct: number | null
  pr_clean_modified_pct: number | null
  availability_modified_pct: number | null
  guaranteed_pr_pct: number
  guaranteed_availability_pct: number
  meter_production_kwh: number | null
  sum_ci_kwp: number | null
  min_irr_threshold: number
}
