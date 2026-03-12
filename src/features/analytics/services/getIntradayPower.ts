import { createSunalizeClient } from '@/lib/supabase/server'

export interface IntradayPoint {
  ts: string
  hour: string // "HH:MM"
  avgPower: number
  totalPower: number
  stringCount: number
  avgPoa: number
}

/**
 * Get intraday power profile for a plant on a specific date.
 *
 * Equivalent to Power BI "Potencia de Strings (W)" line chart:
 * DAX: CountNonNull(Fact_String.P_string) grouped by Fecha
 *
 * Strategy: query a representative sample of strings to get timestamps,
 * then query aggregated power per timestamp. To avoid PostgREST row limits
 * with 693 strings × 48 timestamps = 33K rows, we use server-side aggregation
 * via a single query with efficient filtering.
 */
export async function getIntradayPowerDemo(
  plantId: string,
  date: string
): Promise<IntradayPoint[]> {
  const supabase = createSunalizeClient()

  const dateStart = `${date}T00:00:00`
  const dateEnd = `${date}T23:59:59`

  // Get a representative string to find timestamps.
  // For historical dates not present in fact_string, Supabase returns null data —
  // we return [] gracefully without throwing (the caller handles the empty case).
  const { data: sample } = await supabase
    .from('fact_string')
    .select('string_id')
    .eq('plant_id', plantId)
    .gte('Fecha', dateStart)
    .lte('Fecha', dateEnd)
    .gt('poa', 50)
    .limit(1)
    .single()

  // No intraday data for this date (e.g. historical date only in daily_string_summary)
  if (!sample) return []

  // Get all timestamps for this date from the sample string
  const { data: tsRows } = await supabase
    .from('fact_string')
    .select('Fecha, poa, p_string')
    .eq('plant_id', plantId)
    .eq('string_id', sample.string_id)
    .gte('Fecha', dateStart)
    .lte('Fecha', dateEnd)
    .order('Fecha', { ascending: true })

  if (!tsRows || tsRows.length === 0) return []

  // For each timestamp, we need aggregate stats across all strings.
  // To avoid 693×48 query, fetch per-timestamp aggregates efficiently:
  // Query ALL strings for each timestamp in batch chunks.
  const timestamps = tsRows.map(r => r.Fecha)

  // Strategy: query up to 5 timestamps at a time using IN filter
  // For efficiency, query all strings for all timestamps in one go
  // but limit the total rows (PostgREST default limit is high for sunalize)
  const { data: allRows } = await supabase
    .from('fact_string')
    .select('Fecha, p_string, poa')
    .eq('plant_id', plantId)
    .gte('Fecha', dateStart)
    .lte('Fecha', dateEnd)
    .order('Fecha', { ascending: true })
    .limit(50000) // 693 strings × ~48 timestamps = ~33K

  // Return empty array gracefully if there is no data (historical date or query error)
  if (!allRows || allRows.length === 0) return []

  // Group by timestamp and compute aggregates
  const byTs = new Map<string, { powers: number[]; poas: number[]; count: number }>()

  for (const r of allRows) {
    const ts = r.Fecha
    const entry = byTs.get(ts) ?? { powers: [], poas: [], count: 0 }
    const p = Number(r.p_string)
    const poa = Number(r.poa)
    if (!isNaN(p) && p > 0) {
      entry.powers.push(p)
    }
    if (!isNaN(poa)) {
      entry.poas.push(poa)
    }
    entry.count++
    byTs.set(ts, entry)
  }

  const points: IntradayPoint[] = []
  for (const [ts, entry] of byTs) {
    if (entry.powers.length === 0) continue
    const totalPower = entry.powers.reduce((a, b) => a + b, 0)
    const avgPower = totalPower / entry.powers.length
    const avgPoa = entry.poas.length > 0
      ? entry.poas.reduce((a, b) => a + b, 0) / entry.poas.length
      : 0

    // Extract HH:MM from timestamp
    const timePart = String(ts).substring(11, 16)

    points.push({
      ts,
      hour: timePart,
      avgPower: Math.round(avgPower),
      totalPower: Math.round(totalPower),
      stringCount: entry.powers.length,
      avgPoa: Math.round(avgPoa),
    })
  }

  return points.sort((a, b) => a.ts.localeCompare(b.ts))
}
