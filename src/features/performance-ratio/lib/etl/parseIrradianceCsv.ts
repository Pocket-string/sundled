/**
 * Sonnedix 3 — Irradiance CSV Parser
 *
 * Input format (semicolon-delimited, UTF-8 BOM possible):
 *   Medida;Fecha;Meteo - INSTANT RADIATION POA1_UP DIRECTO (W/m2);Meteo - INSTANT RADIATION POA2_UP DIRECTO (W/m2)
 *   0;01 may. 2025 01:00;0;0
 *
 * Values are W/m2 instantaneous. For hourly intervals: Wh/m2 = W/m2 × 1h (same numeric value).
 *
 * Dual-sensor validation:
 *   - Both within 3% tolerance → average
 *   - Disagree > 3% → use the lower (conservative per PRP-005 learning)
 *   - One missing → use the available one
 *   - Both missing → 'missing'
 */

import { parseGpmDate } from '@/features/ingestion/lib/etl/parseCsv'
import type { IrradianceRawRow, IrradianceCleanRow, IrradianceMethod } from '../../types'

const DEFAULT_IRR_THRESHOLD = 75 // Wh/m2

/** Parse raw irradiance CSV into raw rows (no validation yet). */
export function parseIrradianceCsv(csvText: string): IrradianceRawRow[] {
  const lines = csvText.replace(/^\uFEFF/, '').trim().split('\n')
  if (lines.length < 2) return []

  const separator = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(separator).map(h => h.trim())

  // Find POA column indices by pattern
  const poa1Idx = headers.findIndex(h => /POA1/i.test(h))
  const poa2Idx = headers.findIndex(h => /POA2/i.test(h))

  const rows: IrradianceRawRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator)
    const fechaRaw = values[1]?.trim()
    if (!fechaRaw) continue

    const fecha = normalizeTs(fechaRaw)
    if (!fecha) continue

    rows.push({
      fecha,
      pyranometer1Whm2: parseVal(values[poa1Idx]),
      pyranometer2Whm2: parseVal(values[poa2Idx]),
    })
  }

  return rows
}

/**
 * Validate and clean raw irradiance rows using dual-sensor logic.
 * LIAR 2.0: always average both pyranometers when both are valid.
 */
export function cleanIrradianceRows(
  rows: IrradianceRawRow[],
  minThreshold: number = DEFAULT_IRR_THRESHOLD,
): IrradianceCleanRow[] {
  return rows.map(row => {
    const { treated, method } = validateDualPyranometer(
      row.pyranometer1Whm2,
      row.pyranometer2Whm2,
    )

    return {
      fecha: row.fecha,
      pyranometer1Whm2: row.pyranometer1Whm2,
      pyranometer2Whm2: row.pyranometer2Whm2,
      treatedIrrWhm2: treated,
      validationMethod: method,
      aboveThreshold: treated !== null && treated >= minThreshold,
    }
  })
}

/**
 * Dual-pyranometer validation (LIAR 2.0 logic).
 *
 * LIAR 2.0 uses PyrToll to deduct (flag) faulty sensors, not to switch methods.
 * When both sensors remain valid (Nb pyra remain = 2), result is always average.
 *
 * - Both valid → average
 * - One valid → use it
 * - Neither valid → missing
 */
export function validateDualPyranometer(
  pyro1: number | null,
  pyro2: number | null,
): { treated: number | null; method: IrradianceMethod } {
  const p1Valid = pyro1 !== null && isFinite(pyro1) && pyro1 >= 0
  const p2Valid = pyro2 !== null && isFinite(pyro2) && pyro2 >= 0

  if (!p1Valid && !p2Valid) {
    return { treated: null, method: 'missing' }
  }
  if (p1Valid && !p2Valid) {
    return { treated: pyro1!, method: 'single_pyro' }
  }
  if (!p1Valid && p2Valid) {
    return { treated: pyro2!, method: 'single_pyro' }
  }

  return { treated: (pyro1! + pyro2!) / 2, method: 'avg_pyro' }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseVal(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const v = parseFloat(trimmed.replace(',', '.'))
  return isNaN(v) ? null : v
}

function normalizeTs(fechaRaw: string): string | null {
  const d = parseGpmDate(fechaRaw)
  if (!d) return null
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}
