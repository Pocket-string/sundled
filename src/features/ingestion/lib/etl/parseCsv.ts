/**
 * GPM CSV Parser — Port of loader.py fx_LoadSCADA_day()
 *
 * GPM CSVs use semicolon delimiter, UTF-8 (sometimes BOM).
 * Columns: Medida;Fecha;INV X-Y - CORRIENTE DC IN NN (A);...
 * or:      Medida;Fecha;INV X-Y - TENSIÓN DC IN NN (V);...
 *
 * This module parses and "unpivots" wide GPM CSVs into tall rows.
 */

export interface ScadaRow {
  fecha: string         // raw timestamp string from GPM
  ct_id: string         // e.g. "CT1" — derived from filename/query
  inverter_id: string   // e.g. "INV 1-1"
  dc_in: number         // e.g. 1
  value: number | null  // current (A) or voltage (V)
}

export interface PoaRow {
  fecha: string
  poa: number | null
  t_mod: number | null
}

/**
 * Parse a SCADA CSV (I_Strings or V_String) into tall rows.
 * @param csvText Raw CSV text content
 * @param ctId CT identifier (e.g. "CT1")
 */
export function parseScadaCsv(csvText: string, ctId: string): ScadaRow[] {
  const lines = csvText.replace(/^\uFEFF/, '').trim().split('\n')
  if (lines.length < 2) return []

  const separator = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(separator).map(h => h.trim())

  // Find measurement columns (skip Medida and Fecha)
  const measureCols = headers.slice(2)

  // Pre-extract inverter_id and dc_in from column names
  const colMeta = measureCols.map(col => {
    const invMatch = col.match(/^(INV\s*\d+(?:-\d+)?)/)
    const dcMatch = col.match(/DC\s*IN\s*(\d+)/)
    return {
      inverter_id: invMatch ? invMatch[1].trim() : null,
      dc_in: dcMatch ? parseInt(dcMatch[1], 10) : null,
    }
  })

  const rows: ScadaRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator)
    if (values.length < 3) continue

    const fecha = values[1]?.trim()
    if (!fecha) continue

    for (let j = 0; j < measureCols.length; j++) {
      const meta = colMeta[j]
      if (!meta.inverter_id || meta.dc_in === null) continue

      const rawVal = values[j + 2]?.trim()
      const value = rawVal === '' || rawVal === undefined ? null : parseFloat(rawVal.replace(',', '.'))

      rows.push({
        fecha,
        ct_id: ctId,
        inverter_id: meta.inverter_id,
        dc_in: meta.dc_in,
        value: value !== null && isNaN(value) ? null : value,
      })
    }
  }

  return rows
}

/**
 * Parse POA CSV with dual-sensor validation.
 * Columns: Medida;Fecha;POA1 temp;POA2 temp;POA1 irradiance;POA2 irradiance
 *
 * POA comes in 5-min intervals. We resample to 30-min averages.
 */
export function parsePoaCsv(csvText: string): PoaRow[] {
  const lines = csvText.replace(/^\uFEFF/, '').trim().split('\n')
  if (lines.length < 2) return []

  const separator = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(separator).map(h => h.trim())

  // Find column indices by pattern matching
  const poaIdx = {
    poa1: headers.findIndex(h => /RADIATION.*POA1/i.test(h)),
    poa2: headers.findIndex(h => /RADIATION.*POA2/i.test(h)),
    tmod1: headers.findIndex(h => /TEMPERATURE.*POA1/i.test(h)),
    tmod2: headers.findIndex(h => /TEMPERATURE.*POA2/i.test(h)),
  }

  // Parse raw 5-min rows
  const rawRows: Array<{ fecha: string; poa1: number | null; poa2: number | null; tmod1: number | null; tmod2: number | null }> = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator)
    const fecha = values[1]?.trim()
    if (!fecha) continue

    const parseVal = (idx: number): number | null => {
      if (idx < 0) return null
      const raw = values[idx]?.trim()
      if (!raw) return null
      const v = parseFloat(raw.replace(',', '.'))
      return isNaN(v) ? null : v
    }

    rawRows.push({
      fecha,
      poa1: parseVal(poaIdx.poa1),
      poa2: parseVal(poaIdx.poa2),
      tmod1: parseVal(poaIdx.tmod1),
      tmod2: parseVal(poaIdx.tmod2),
    })
  }

  // Dual-sensor validation per row (port of loader.py logic)
  const validatedRows = rawRows.map(r => {
    const poa = validateDualSensor(r.poa1, r.poa2, 0, 1500, 0.30)
    const tmod = validateDualSensor(r.tmod1, r.tmod2, -40, 100, 0.30)
    return { fecha: r.fecha, poa, t_mod: tmod }
  })

  // Resample to 30-min averages
  return resample30min(validatedRows)
}

/**
 * Dual-sensor validation logic from loader.py:
 * - Both must be within plausibility range
 * - If both valid and agree within tolerance: use average
 * - Otherwise: use whichever has higher valid value
 */
function validateDualSensor(
  a: number | null,
  b: number | null,
  min: number,
  max: number,
  tolerance: number
): number | null {
  const aValid = a !== null && a >= min && a <= max
  const bValid = b !== null && b >= min && b <= max

  if (!aValid && !bValid) return null
  if (aValid && !bValid) return a
  if (!aValid && bValid) return b

  // Both valid — check agreement
  const ratio = a! / b!
  if (ratio >= 1 / (1 + tolerance) && ratio <= 1 + tolerance) {
    return (a! + b!) / 2
  }

  // Disagreement: use higher value
  return a! > b! ? a! : b!
}

/**
 * Resample 5-min POA data to 30-min averages.
 * Groups by rounding timestamp down to nearest 30-min boundary.
 */
function resample30min(rows: Array<{ fecha: string; poa: number | null; t_mod: number | null }>): PoaRow[] {
  const buckets = new Map<string, { poaSum: number; poaCount: number; tmodSum: number; tmodCount: number }>()

  for (const row of rows) {
    const ts = parseGpmDate(row.fecha)
    if (!ts) continue

    // Round down to 30-min boundary
    const mins = ts.getMinutes()
    ts.setMinutes(mins >= 30 ? 30 : 0, 0, 0)
    const key = formatLocalTs(ts)

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { poaSum: 0, poaCount: 0, tmodSum: 0, tmodCount: 0 }
      buckets.set(key, bucket)
    }

    if (row.poa !== null) {
      bucket.poaSum += row.poa
      bucket.poaCount++
    }
    if (row.t_mod !== null) {
      bucket.tmodSum += row.t_mod
      bucket.tmodCount++
    }
  }

  return Array.from(buckets.entries()).map(([fecha, b]) => ({
    fecha,
    poa: b.poaCount > 0 ? b.poaSum / b.poaCount : null,
    t_mod: b.tmodCount > 0 ? b.tmodSum / b.tmodCount : null,
  }))
}

// Spanish month abbreviation map for GPM dates
const MONTH_MAP: Record<string, string> = {
  'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
  'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
  'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
}

/**
 * Parse GPM date string: "01 ago. 2025 00:30" -> Date
 */
export function parseGpmDate(dateStr: string): Date | null {
  if (!dateStr) return null

  // Try Spanish format: "dd MMM. YYYY HH:MM"
  const match = dateStr.match(/^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})\s+(\d{1,2}):(\d{2})$/i)
  if (match) {
    const [, day, monthAbbr, year, hour, minute] = match
    const month = MONTH_MAP[monthAbbr.toLowerCase()]
    if (month) {
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute))
    }
  }

  // Fallback: try standard date parse
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

function formatLocalTs(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}
