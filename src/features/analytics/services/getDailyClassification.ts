import { createSunalizeClient } from '@/lib/supabase/server'
import type { AnalyticsClass } from '../types'

export interface DayClassification {
  date: string
  class: AnalyticsClass
  ratio: number | null
  peakIntervals: number
  poaThreshold: number | null
}

/**
 * Compute daily classification for a string using module-group P75 reference.
 * Queries peer data at peak timestamps to get the correct cross-string reference.
 *
 * This matches the dashboard methodology:
 *  1. For each day, find P95 POA threshold
 *  2. Select peak timestamps (POA ≥ P95, min 2)
 *  3. At each peak, compute P75 across all strings of same module wattage
 *  4. PI = sum(p_string) / sum(P75) → classify
 */
export async function getDailyClassificationForStringDemo(
  plantId: string,
  stringId: string,
  days: number = 14
): Promise<DayClassification[]> {
  const supabase = createSunalizeClient()

  // Get this string's module wattage from peer_group
  const { data: tracker } = await supabase
    .from('dim_trackers')
    .select('peer_group')
    .eq('plant_id', plantId)
    .eq('string_id', stringId)
    .single()

  const moduleW = parseModuleW(tracker?.peer_group)
  if (!moduleW) return []

  // Get this string's daytime intervals
  const { data: stringRows } = await supabase
    .from('fact_string')
    .select('Fecha, p_string, poa')
    .eq('plant_id', plantId)
    .eq('string_id', stringId)
    .gt('poa', 50)
    .order('Fecha', { ascending: false })
    .limit(48 * days)

  if (!stringRows || stringRows.length === 0) return []

  // Group by day
  const byDay = new Map<string, { ts: string; poa: number }[]>()
  for (const row of stringRows) {
    const poa = sanitize(row.poa)
    if (poa === null || poa <= 50) continue
    const day = row.Fecha.substring(0, 10)
    const arr = byDay.get(day) ?? []
    arr.push({ ts: row.Fecha, poa })
    byDay.set(day, arr)
  }

  // Collect all peak timestamps across all days
  interface PeakInfo { ts: string; date: string; poa: number }
  const allPeaks: PeakInfo[] = []
  const dayThresholds = new Map<string, number>()

  for (const [date, dayRows] of byDay) {
    if (dayRows.length < 3) continue

    // P95 POA for this day
    const sorted = [...dayRows].sort((a, b) => a.poa - b.poa)
    const p95Idx = Math.ceil(sorted.length * 0.95) - 1
    const p95 = sorted[Math.max(0, p95Idx)].poa
    dayThresholds.set(date, p95)

    // Select peaks
    let peaks = dayRows.filter((r) => r.poa >= p95)
    if (peaks.length < 2) {
      peaks = [...dayRows].sort((a, b) => b.poa - a.poa).slice(0, 2)
    }

    for (const p of peaks) {
      allPeaks.push({ ts: p.ts, date, poa: p.poa })
    }
  }

  if (allPeaks.length === 0) return []

  // Query peer data at all peak timestamps in parallel
  const peakResults = await Promise.all(
    allPeaks.map(async (peak) => {
      const { data: allRows } = await supabase
        .from('fact_string')
        .select('string_id, p_string, peer_group')
        .eq('plant_id', plantId)
        .eq('Fecha', peak.ts)
        .limit(1000)

      // Filter to same module group and sanitize NaN
      const moduleGroupP: number[] = []
      let thisStringP: number | null = null

      for (const row of allRows ?? []) {
        const p = sanitize(row.p_string)
        if (p === null || p <= 0) continue
        if (parseModuleW(row.peer_group) === moduleW) {
          moduleGroupP.push(p)
        }
        if (row.string_id === stringId) {
          thisStringP = p
        }
      }

      return { date: peak.date, moduleGroupP, thisStringP }
    })
  )

  // Aggregate by day
  const dayAgg = new Map<string, { sumP: number; sumP75: number; validPeaks: number }>()
  for (const result of peakResults) {
    if (result.moduleGroupP.length < 5 || result.thisStringP === null) continue

    // P75 of module group
    const sorted = [...result.moduleGroupP].sort((a, b) => a - b)
    const p75Idx = Math.ceil(sorted.length * 0.75) - 1
    const p75 = sorted[p75Idx]

    if (p75 <= 0) continue

    const agg = dayAgg.get(result.date) ?? { sumP: 0, sumP75: 0, validPeaks: 0 }
    agg.sumP += result.thisStringP
    agg.sumP75 += p75
    agg.validPeaks++
    dayAgg.set(result.date, agg)
  }

  // Build results
  const results: DayClassification[] = []
  for (const [date, dayRows] of byDay) {
    const agg = dayAgg.get(date)
    const p95 = dayThresholds.get(date) ?? null

    if (!agg || agg.validPeaks === 0 || agg.sumP75 === 0) {
      results.push({ date, class: 'gray', ratio: null, peakIntervals: 0, poaThreshold: p95 })
      continue
    }

    const ratio = agg.sumP / agg.sumP75
    const cls: AnalyticsClass =
      ratio >= 0.95 ? 'green' :
      ratio >= 0.80 ? 'blue' :
      ratio >= 0.60 ? 'orange' : 'red'

    results.push({
      date,
      class: cls,
      ratio,
      peakIntervals: agg.validPeaks,
      poaThreshold: p95,
    })
  }

  return results.sort((a, b) => a.date.localeCompare(b.date))
}

function parseModuleW(peerGroup: string | null | undefined): number | null {
  if (!peerGroup) return null
  const match = peerGroup.match(/(\d+)$/)
  return match ? parseInt(match[1]) : null
}

function sanitize(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}
