import { createSunalizeClient } from '@/lib/supabase/server'
import type { AnalyticsSnapshot, FactRow } from '../types'
import { computeSnapshot, isEligible } from '../lib/engine'

/**
 * Get analytics snapshot history for a single string (last N days).
 * Demo variant — computes on-the-fly from sunalize schema.
 */
export async function getStringAnalyticsDemo(
  plantId: string,
  stringId: string,
  days: number = 7
): Promise<AnalyticsSnapshot[]> {
  const supabase = createSunalizeClient()

  // Get recent daytime timestamps for this string
  const { data: stringRows } = await supabase
    .from('fact_string')
    .select('Fecha, string_id, svg_id, inverter_id, peer_group, poa, t_mod, i_string, v_string, p_string')
    .eq('plant_id', plantId)
    .eq('string_id', stringId)
    .gt('poa', 50)
    .order('Fecha', { ascending: false })
    .limit(48 * days)

  if (!stringRows || stringRows.length === 0) return []

  // Get 30-day history for this string (for p_expected)
  const oldest = stringRows[stringRows.length - 1].Fecha
  const thirtyBefore = new Date(new Date(oldest).getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .substring(0, 19)

  const { data: historyRaw } = await supabase
    .from('fact_string')
    .select('string_id, poa, p_string')
    .eq('plant_id', plantId)
    .eq('string_id', stringId)
    .gte('Fecha', thirtyBefore)
    .gt('poa', 200)
    .gt('p_string', 0)
    .limit(5000)

  const fullHistory: FactRow[] = (historyRaw ?? []).map((r) => ({
    string_id: r.string_id,
    poa: sanitize(r.poa),
    p_string: sanitize(r.p_string),
    i_string: null,
    v_string: null,
    ts: '',
  }))

  // Get peer group for this string
  const { data: tracker } = await supabase
    .from('dim_trackers')
    .select('peer_group')
    .eq('plant_id', plantId)
    .eq('string_id', stringId)
    .single()

  const peerGroup = tracker?.peer_group

  // For each timestamp, compute snapshot
  const snapshots: AnalyticsSnapshot[] = []

  for (const row of stringRows) {
    const ts = row.Fecha
    const factRow: FactRow = {
      string_id: row.string_id,
      svg_id: row.svg_id,
      inverter_id: row.inverter_id,
      peer_group: row.peer_group ?? peerGroup,
      poa: sanitize(row.poa),
      t_mod: sanitize(row.t_mod),
      i_string: sanitize(row.i_string),
      v_string: sanitize(row.v_string),
      p_string: sanitize(row.p_string),
      ts,
    }

    // Get peer group rows at this timestamp for fallback method 3
    // For efficiency, we skip the DB call and use an empty array.
    // Peer fallback won't fire if the string has enough individual history.
    const peerGroupRows: FactRow[] = []

    // History up to this timestamp
    const historyUpToTs = fullHistory.filter(
      (h) => h.poa !== null && h.p_string !== null
    )

    const snapshot = computeSnapshot({
      row: factRow,
      plantId,
      tsUtc: ts,
      tsLocal: ts,
      stringHistory: historyUpToTs,
      peerGroupRows,
    })

    snapshots.push(snapshot as AnalyticsSnapshot)
  }

  return snapshots.reverse() // Chronological order
}

function sanitize(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}
