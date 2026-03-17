/**
 * Parser for unavailability events CSV.
 *
 * Expected format (semicolon-delimited):
 *   fecha_inicio;fecha_fin;inverter_id;liability;descripcion
 *   2025-10-15 08:00;2025-10-15 14:30;INV 1-3;contractor;Falla de comunicacion
 *   2025-10-20 00:00;2025-10-20 23:59;ALL;operator;Curtailment CDEC
 *
 * Also accepts comma-delimited if no semicolons detected.
 */

import type { UnavailabilityEvent, Liability } from '../../types'

export interface ParseResult {
  events: UnavailabilityEvent[]
  errors: string[]
}

const VALID_LIABILITY: Set<string> = new Set(['contractor', 'operator'])
const TS_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/

function normalizeTs(ts: string): string {
  const trimmed = ts.trim()
  // Add :00 seconds if missing
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)) {
    return trimmed + ':00'
  }
  return trimmed
}

export function parseUnavailabilityCsv(
  text: string,
  plantId: string,
): ParseResult {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  if (lines.length === 0) {
    return { events: [], errors: ['Empty file'] }
  }

  // Detect delimiter from header
  const header = lines[0].toLowerCase()
  const delimiter = header.includes(';') ? ';' : ','

  // Validate header
  const cols = header.split(delimiter).map(c => c.trim())
  const requiredCols = ['fecha_inicio', 'fecha_fin', 'inverter_id', 'liability']
  const missing = requiredCols.filter(c => !cols.includes(c))
  if (missing.length > 0) {
    return { events: [], errors: [`Missing columns: ${missing.join(', ')}`] }
  }

  const idxStart = cols.indexOf('fecha_inicio')
  const idxEnd = cols.indexOf('fecha_fin')
  const idxInv = cols.indexOf('inverter_id')
  const idxLiab = cols.indexOf('liability')
  const idxDesc = cols.indexOf('descripcion')

  const events: UnavailabilityEvent[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(delimiter).map(f => f.trim())
    const lineNum = i + 1

    const startTs = normalizeTs(fields[idxStart] ?? '')
    const endTs = normalizeTs(fields[idxEnd] ?? '')
    const rawInvId = fields[idxInv] ?? ''
    const liability = (fields[idxLiab] ?? '').toLowerCase()
    const description = idxDesc >= 0 ? (fields[idxDesc] ?? null) : null

    // Validate timestamps
    if (!TS_RE.test(startTs)) {
      errors.push(`Line ${lineNum}: invalid fecha_inicio "${fields[idxStart]}"`)
      continue
    }
    if (!TS_RE.test(endTs)) {
      errors.push(`Line ${lineNum}: invalid fecha_fin "${fields[idxEnd]}"`)
      continue
    }
    if (startTs > endTs) {
      errors.push(`Line ${lineNum}: fecha_inicio > fecha_fin`)
      continue
    }

    // Validate liability
    if (!VALID_LIABILITY.has(liability)) {
      errors.push(`Line ${lineNum}: invalid liability "${fields[idxLiab]}" (must be contractor or operator)`)
      continue
    }

    // Normalize inverter_id: "ALL" or empty → null (whole plant)
    const inverterId =
      rawInvId === '' || rawInvId.toUpperCase() === 'ALL' ? null : rawInvId

    events.push({
      plant_id: plantId,
      start_ts: startTs,
      end_ts: endTs,
      inverter_id: inverterId,
      liability: liability as Liability,
      description: description || null,
    })
  }

  return { events, errors }
}
