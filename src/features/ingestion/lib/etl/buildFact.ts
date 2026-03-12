/**
 * ETL Pipeline — Port of loader.py build_fact_string()
 *
 * Merges I (current) + V (voltage) rows, computes P = I * V,
 * joins with dim_trackers to resolve string_id/svg_id,
 * merges POA data, and produces fact_string rows ready for UPSERT.
 */

import type { ScadaRow, PoaRow } from './parseCsv'
import { parseGpmDate } from './parseCsv'

export interface DimTracker {
  ct_id: string
  inverter_id: string
  inverter_base: string | null
  dc_in: number
  string_id: string
  svg_id: string
  inverter_dc_key: string
  module: string | null
  peer_group: string | null
}

export interface FactStringRow {
  org_id: string
  plant_id: string
  ts_local: string          // "YYYY-MM-DD HH:MM:SS"
  string_id: string
  svg_id: string
  inverter_id: string
  inverter_dc_key: string
  dc_in: number
  module: string | null
  peer_group: string | null
  i_string: number | null
  v_string: number | null
  p_string: number | null
  poa: number | null
  t_mod: number | null
}

/**
 * Build fact_string rows from parsed SCADA (I/V) and POA data.
 */
export function buildFactString(
  iRows: ScadaRow[],
  vRows: ScadaRow[],
  poaRows: PoaRow[],
  trackers: DimTracker[],
  orgId: string,
  plantId: string,
): FactStringRow[] {
  // Build tracker lookup: "ct_id|inverter_id|dc_in" -> DimTracker[]
  // Multiple strings can share the same DC IN (peer_group "2x540" = 2 parallel strings)
  const trackerMap = new Map<string, DimTracker[]>()
  // Also build fallback by inverter_base for cases where SCADA uses base form
  const baseMap = new Map<string, DimTracker[]>()

  for (const t of trackers) {
    const key = `${t.ct_id}|${t.inverter_id}|${t.dc_in}`
    const arr = trackerMap.get(key) ?? []
    arr.push(t)
    trackerMap.set(key, arr)

    if (t.inverter_base) {
      const baseKey = `${t.ct_id}|${t.inverter_base}|${t.dc_in}`
      const baseArr = baseMap.get(baseKey) ?? []
      baseArr.push(t)
      baseMap.set(baseKey, baseArr)
    }
  }

  // Build I map: "fecha|ct_id|inverter_id|dc_in" -> value
  const iMap = new Map<string, number | null>()
  for (const row of iRows) {
    const key = `${normalizeTs(row.fecha)}|${row.ct_id}|${row.inverter_id}|${row.dc_in}`
    iMap.set(key, row.value)
  }

  // Build V map
  const vMap = new Map<string, number | null>()
  for (const row of vRows) {
    const key = `${normalizeTs(row.fecha)}|${row.ct_id}|${row.inverter_id}|${row.dc_in}`
    vMap.set(key, row.value)
  }

  // Build POA map: "ts_local" -> { poa, t_mod }
  const poaMap = new Map<string, { poa: number | null; t_mod: number | null }>()
  for (const row of poaRows) {
    poaMap.set(row.fecha, { poa: row.poa, t_mod: row.t_mod })
  }

  // Collect all unique measurement keys from I and V
  const allKeys = new Set<string>()
  for (const key of iMap.keys()) allKeys.add(key)
  for (const key of vMap.keys()) allKeys.add(key)

  const facts: FactStringRow[] = []

  for (const key of allKeys) {
    const [ts, ctId, inverterId, dcInStr] = key.split('|')
    const dcIn = parseInt(dcInStr, 10)

    // Resolve tracker group (1:N — multiple strings can share one DC IN)
    const trackerKey = `${ctId}|${inverterId}|${dcIn}`
    let group = trackerMap.get(trackerKey)

    // Fallback: try inverter_base resolution
    if (!group || group.length === 0) {
      const baseMatch = inverterId.match(/^(INV\s*\d+)/)
      if (baseMatch) {
        const baseKey = `${ctId}|${baseMatch[1]}|${dcIn}`
        group = baseMap.get(baseKey)
      }
    }

    // Skip rows without tracker match (same as loader.py dropping unmatched)
    if (!group || group.length === 0) continue

    const iVal = iMap.get(key) ?? null
    const vVal = vMap.get(key) ?? null
    const poaData = poaMap.get(ts)

    // Split current among N parallel strings sharing this DC IN
    // Voltage is shared (parallel circuit), Power = (I/N) * V
    const n = group.length
    const iSplit = iVal !== null ? iVal / n : null
    const pSplit = iSplit !== null && vVal !== null ? iSplit * vVal : null

    for (const tracker of group) {
      facts.push({
        org_id: orgId,
        plant_id: plantId,
        ts_local: ts,
        string_id: tracker.string_id,
        svg_id: tracker.svg_id,
        inverter_id: tracker.inverter_id,
        inverter_dc_key: tracker.inverter_dc_key,
        dc_in: tracker.dc_in,
        module: tracker.module,
        peer_group: tracker.peer_group,
        i_string: iSplit,
        v_string: vVal,
        p_string: pSplit,
        poa: poaData?.poa ?? null,
        t_mod: poaData?.t_mod ?? null,
      })
    }
  }

  return facts
}

/**
 * Normalize a GPM timestamp to "YYYY-MM-DD HH:MM:00" format.
 */
function normalizeTs(fecha: string): string {
  const d = parseGpmDate(fecha)
  if (!d) return fecha

  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}
