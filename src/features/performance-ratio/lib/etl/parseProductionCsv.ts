/**
 * Sonnedix 1 + 2 — Production CSV Parsers
 *
 * Sonnedix 1 (Inverter Production):
 *   Medida;Fecha;INV 1-1 - ENERGIA ACTIVA TOTAL EXPORTADA (kWh);...;INV 3-14 - ...
 *   Wide format: 42 columns (Medida + Fecha + 40 inverters)
 *   Values: integer kWh, many empty cells (;;)
 *   Date format: "28 abr. 2025 01:00" (Spanish)
 *
 * Sonnedix 2 (Meter):
 *   Medida;Fecha;ION7400 - ENERGIA ACTIVA EXPORTADA (kWh);ION7400 - ENERGIA ACTIVA IMPORTADA (kWh);ION8650 - ...;ION8650 - ...
 *   4 measurement columns
 */

import { parseGpmDate } from '@/features/ingestion/lib/etl/parseCsv'
import type { InverterProductionRow, MeterRow } from '../../types'

/**
 * Parse Sonnedix 1 CSV — unpivots wide inverter columns into tall rows.
 * One output row per inverter per timestamp.
 */
export function parseInverterProductionCsv(csvText: string): InverterProductionRow[] {
  const lines = csvText.replace(/^\uFEFF/, '').trim().split('\n')
  if (lines.length < 2) return []

  const separator = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(separator).map(h => h.trim())

  // Extract inverter IDs from headers (columns 2+)
  // Header pattern: "INV X-Y - ENERGIA ACTIVA TOTAL EXPORTADA (kWh)"
  const inverterCols = headers.slice(2).map(h => {
    const match = h.match(/^(INV\s*\d+-\d+)/)
    return match ? match[1].trim() : null
  })

  const rows: InverterProductionRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator)
    const fechaRaw = values[1]?.trim()
    if (!fechaRaw) continue

    const fecha = normalizeTs(fechaRaw)
    if (!fecha) continue

    for (let j = 0; j < inverterCols.length; j++) {
      const inverterId = inverterCols[j]
      if (!inverterId) continue

      rows.push({
        fecha,
        inverterId,
        productionKwh: parseVal(values[j + 2]),
      })
    }
  }

  return rows
}

/**
 * Parse Sonnedix 2 CSV — meter readings (export/import).
 * Returns one row per meter per timestamp.
 */
export function parseMeterCsv(csvText: string): MeterRow[] {
  const lines = csvText.replace(/^\uFEFF/, '').trim().split('\n')
  if (lines.length < 2) return []

  const separator = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(separator).map(h => h.trim())

  // Find meter columns by pattern: "IONXXXX - ENERGIA ACTIVA EXPORTADA/IMPORTADA"
  const meterCols: Array<{
    meterId: string
    type: 'exported' | 'imported'
    colIdx: number
  }> = []

  for (let i = 2; i < headers.length; i++) {
    const exportMatch = headers[i].match(/^(ION\d+)\s*-\s*ENERGIA ACTIVA EXPORTADA/i)
    if (exportMatch) {
      meterCols.push({ meterId: exportMatch[1], type: 'exported', colIdx: i })
      continue
    }
    const importMatch = headers[i].match(/^(ION\d+)\s*-\s*ENERGIA ACTIVA IMPORTADA/i)
    if (importMatch) {
      meterCols.push({ meterId: importMatch[1], type: 'imported', colIdx: i })
    }
  }

  // Group columns by meterId
  const meterIds = [...new Set(meterCols.map(c => c.meterId))]
  const meterMap = new Map<string, { exportIdx: number; importIdx: number }>()
  for (const mid of meterIds) {
    const exp = meterCols.find(c => c.meterId === mid && c.type === 'exported')
    const imp = meterCols.find(c => c.meterId === mid && c.type === 'imported')
    if (exp) {
      meterMap.set(mid, {
        exportIdx: exp.colIdx,
        importIdx: imp?.colIdx ?? -1,
      })
    }
  }

  const rows: MeterRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator)
    const fechaRaw = values[1]?.trim()
    if (!fechaRaw) continue

    const fecha = normalizeTs(fechaRaw)
    if (!fecha) continue

    for (const [meterId, cols] of meterMap) {
      rows.push({
        fecha,
        meterId,
        exportedKwh: parseVal(values[cols.exportIdx]),
        importedKwh: cols.importIdx >= 0 ? parseVal(values[cols.importIdx]) : null,
      })
    }
  }

  return rows
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
