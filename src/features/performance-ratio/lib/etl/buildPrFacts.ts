/**
 * PR Facts Builder — transforms parsed CSV rows into fact table rows
 * ready for upsert into sunalize.fact_irradiance and sunalize.fact_inverter_production.
 *
 * Follows the same pattern as src/features/ingestion/lib/etl/buildFact.ts:
 * - Join with dim tables (dim_inverters for Wp lookup)
 * - Sanitize NaN → null
 * - Produce rows matching DB schema
 */

import type {
  IrradianceCleanRow,
  InverterProductionRow,
  MeterRow,
  DimInverter,
  FactIrradianceRow,
  FactInverterProductionRow,
} from '../../types'

/**
 * Build fact_irradiance rows from cleaned irradiance data.
 */
export function buildFactIrradiance(
  cleanRows: IrradianceCleanRow[],
  plantId: string,
): FactIrradianceRow[] {
  return cleanRows.map(row => ({
    plant_id: plantId,
    Fecha: row.fecha,
    pyranometer_1_whm2: sanitize(row.pyranometer1Whm2),
    pyranometer_2_whm2: sanitize(row.pyranometer2Whm2),
    solargis_whm2: null, // Not available for Angamos
    treated_irr_whm2: sanitize(row.treatedIrrWhm2),
    validation_method: row.validationMethod,
    above_threshold: row.aboveThreshold,
  }))
}

/**
 * Build fact_inverter_production rows from parsed inverter production data.
 * Joins with dim_inverters to resolve peak_power_kwp for each inverter.
 */
export function buildFactInverterProduction(
  prodRows: InverterProductionRow[],
  inverters: DimInverter[],
  plantId: string,
): FactInverterProductionRow[] {
  // Build Wp lookup: "INV 1-1" → peak_power_kwp
  const wpMap = new Map<string, number>()
  for (const inv of inverters) {
    wpMap.set(inv.inverter_id, inv.peak_power_kwp)
  }

  // Filter out rows with null production to prevent overwriting real data
  // when multiple weekly CSV files cover overlapping timestamps but different inverter subsets
  return prodRows
    .filter(row => row.productionKwh !== null && row.productionKwh !== undefined)
    .map(row => ({
      plant_id: plantId,
      Fecha: row.fecha,
      inverter_id: row.inverterId,
      production_kwh: sanitize(row.productionKwh),
      peak_power_kwp: wpMap.get(row.inverterId) ?? null,
    }))
}

/**
 * Build fact_inverter_production rows from meter readings.
 * Meters get a synthetic inverter_id: "METER_ION7400", "METER_ION8650".
 */
export function buildFactMeterProduction(
  meterRows: MeterRow[],
  plantId: string,
): FactInverterProductionRow[] {
  return meterRows.map(row => ({
    plant_id: plantId,
    Fecha: row.fecha,
    inverter_id: `METER_${row.meterId}`,
    production_kwh: sanitize(row.exportedKwh),
    peak_power_kwp: null, // Meters have no Wp
  }))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitize NaN/Infinity → null (PostgreSQL safety). */
function sanitize(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  if (!isFinite(v)) return null
  return v
}
