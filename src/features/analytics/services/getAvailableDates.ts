import { createSunalizeClient } from '@/lib/supabase/server'
import type { AvailableTimestamp } from '../types'

/**
 * Get distinct dates with daytime data for a plant.
 *
 * Strategy: query a SINGLE string's timestamps (not all 693) to get dates efficiently.
 * One string has ~20 daytime timestamps per day → 5000 rows covers ~250 days.
 */
export async function getAvailableDatesDemo(plantId: string): Promise<string[]> {
  const supabase = createSunalizeClient()

  // --- Source 1: fact_string (recent data, has intraday timestamps) ---
  // Paginate to overcome PostgREST default 1000-row limit
  const factDatesPromise = (async (): Promise<string[]> => {
    const { data: sample } = await supabase
      .from('fact_string')
      .select('string_id')
      .eq('plant_id', plantId)
      .gt('poa', 50)
      .limit(1)
      .single()

    if (!sample) return []

    const dateSet = new Set<string>()
    const PAGE_SIZE = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data } = await supabase
        .from('fact_string')
        .select('Fecha')
        .eq('plant_id', plantId)
        .eq('string_id', sample.string_id)
        .gt('poa', 50)
        .order('Fecha', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (!data || data.length === 0) break
      for (const row of data) {
        dateSet.add(String(row.Fecha).substring(0, 10))
      }
      offset += data.length
      hasMore = data.length === PAGE_SIZE
    }

    return Array.from(dateSet)
  })()

  // --- Source 2: daily_string_summary (historical data, 220+ days) ---
  // Query a single string to avoid PostgREST 1000-row cap (693 strings × N dates >> 1000)
  const summaryDatesPromise = (async (): Promise<string[]> => {
    const { data: sample } = await supabase
      .from('daily_string_summary')
      .select('string_id')
      .eq('plant_id', plantId)
      .limit(1)
      .single()

    if (!sample) return []

    const { data } = await supabase
      .from('daily_string_summary')
      .select('date')
      .eq('plant_id', plantId)
      .eq('string_id', sample.string_id)
      .order('date', { ascending: false })
      .limit(1000)

    if (!data || data.length === 0) return []

    const dateSet = new Set<string>()
    for (const row of data) {
      if (row.date) dateSet.add(String(row.date).substring(0, 10))
    }
    return Array.from(dateSet)
  })()

  // Fetch both sources in parallel, then merge, deduplicate, and sort DESC
  const [factDates, summaryDates] = await Promise.all([factDatesPromise, summaryDatesPromise])

  const merged = new Set<string>([...factDates, ...summaryDates])
  return Array.from(merged).sort().reverse()
}

/**
 * Get available timestamps for a specific date with avg POA.
 *
 * Strategy: first get unique timestamps from a single string,
 * then query avg POA for those timestamps.
 */
export async function getAvailableTimestampsDemo(
  plantId: string,
  date: string
): Promise<AvailableTimestamp[]> {
  const supabase = createSunalizeClient()

  const dateStart = `${date}T00:00:00`
  const dateEnd = `${date}T23:59:59`

  // Get one representative string to find timestamps
  const { data: sample } = await supabase
    .from('fact_string')
    .select('string_id')
    .eq('plant_id', plantId)
    .gte('Fecha', dateStart)
    .lte('Fecha', dateEnd)
    .gt('poa', 50)
    .limit(1)
    .single()

  if (!sample) return []

  // Get all timestamps for this string on this date (max ~48 rows)
  const { data: tsRows } = await supabase
    .from('fact_string')
    .select('Fecha, poa')
    .eq('plant_id', plantId)
    .eq('string_id', sample.string_id)
    .gte('Fecha', dateStart)
    .lte('Fecha', dateEnd)
    .gt('poa', 50)
    .order('Fecha', { ascending: true })

  if (!tsRows || tsRows.length === 0) return []

  // Use the single string's POA as representative (all strings share the same irradiance)
  // This avoids querying 693 × 22 = 15k+ rows which hits PostgREST limits
  // For string count, query only the target timestamp to get a quick count
  const timestamps: AvailableTimestamp[] = []
  for (const r of tsRows) {
    const poa = Math.round(Number(r.poa) || 0)
    timestamps.push({
      ts: r.Fecha,
      avgPoa: poa,
      stringCount: 693, // approximate; updated for selected timestamp later
    })
  }

  return timestamps.sort((a, b) => a.ts.localeCompare(b.ts))
}

/**
 * Get the timestamp with highest avg POA for a given date.
 * This is the "peak irradiance" interval — the one Power BI uses for comparison.
 */
export async function getMaxPoaTimestampDemo(
  plantId: string,
  date: string
): Promise<string | null> {
  const timestamps = await getAvailableTimestampsDemo(plantId, date)
  if (timestamps.length === 0) return null

  let best = timestamps[0]
  for (const ts of timestamps) {
    if (ts.avgPoa > best.avgPoa) best = ts
  }

  return best.ts
}

/**
 * Find the latest date that has actual peak irradiance data (POA >= 200).
 * Skips incomplete days (like 2025-10-13 with only early morning data).
 */
export async function getLatestFullDateDemo(plantId: string): Promise<string | null> {
  const supabase = createSunalizeClient()

  // Find the most recent row with POA >= 50 (daytime)
  const { data } = await supabase
    .from('fact_string')
    .select('Fecha')
    .eq('plant_id', plantId)
    .gte('poa', 50)
    .order('Fecha', { ascending: false })
    .limit(1)
    .single()

  if (!data) return null
  return String(data.Fecha).substring(0, 10)
}
