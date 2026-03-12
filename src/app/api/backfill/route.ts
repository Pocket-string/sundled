import { NextResponse } from 'next/server'
import { getAvailableDatesDemo } from '@/features/analytics/services/getAvailableDates'
import { backfillDailySummariesDemo } from '@/features/analytics/services/computeDailySummary'
import { createSunalizeClient } from '@/lib/supabase/server'

/**
 * POST /api/backfill
 *
 * Backfill daily_string_summary for all available dates (or a subset).
 * Body: { plantId: string, dates?: string[], purgeOlderThanDays?: number }
 *
 * Usage:
 *   curl -X POST http://localhost:3000/api/backfill \
 *     -H 'Content-Type: application/json' \
 *     -d '{"plantId":"PLT_A"}'
 *
 * With purge (delete raw fact_string older than 14 days):
 *   -d '{"plantId":"PLT_A","purgeOlderThanDays":14}'
 */
export async function POST(request: Request) {
  const body = await request.json()
  const { plantId, dates: requestedDates, purgeOlderThanDays } = body as {
    plantId: string
    dates?: string[]
    purgeOlderThanDays?: number
  }

  if (!plantId) {
    return NextResponse.json({ error: 'plantId is required' }, { status: 400 })
  }

  // Step 1: Determine dates to backfill
  const allDates = requestedDates ?? (await getAvailableDatesDemo(plantId))
  if (allDates.length === 0) {
    return NextResponse.json({ message: 'No dates available', inserted: 0 })
  }

  // Step 2: Check which dates already have summaries (skip them)
  const supabase = createSunalizeClient()
  const { data: existingSummaries } = await supabase
    .from('daily_string_summary')
    .select('date')
    .eq('plant_id', plantId)
    .in('date', allDates)

  const existingDates = new Set((existingSummaries ?? []).map((r) => String(r.date)))
  const datesToProcess = allDates.filter((d) => !existingDates.has(d))

  if (datesToProcess.length === 0) {
    return NextResponse.json({
      message: 'All dates already have summaries',
      skipped: allDates.length,
      inserted: 0,
    })
  }

  // Step 3: Backfill missing dates
  const result = await backfillDailySummariesDemo(plantId, datesToProcess)

  // Step 4: Optionally purge old raw data
  let purged = 0
  if (purgeOlderThanDays && purgeOlderThanDays > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - purgeOlderThanDays)
    const cutoffStr = cutoff.toISOString().substring(0, 10)

    const { count, error } = await supabase
      .from('fact_string')
      .delete({ count: 'exact' })
      .eq('plant_id', plantId)
      .lt('Fecha', cutoffStr)

    if (error) {
      console.error('[backfill] Purge error:', error.message)
    } else {
      purged = count ?? 0
    }
  }

  return NextResponse.json({
    message: 'Backfill complete',
    totalDates: allDates.length,
    skipped: existingDates.size,
    processed: result.processed.length,
    inserted: result.total,
    purged,
  })
}

/**
 * GET /api/backfill?plantId=PLT_A
 *
 * Check backfill status: how many dates have summaries vs total available.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const plantId = url.searchParams.get('plantId') ?? 'PLT_A'

  const allDates = await getAvailableDatesDemo(plantId)

  const supabase = createSunalizeClient()
  const { count: summaryCount } = await supabase
    .from('daily_string_summary')
    .select('*', { count: 'exact', head: true })
    .eq('plant_id', plantId)

  const { count: factCount } = await supabase
    .from('fact_string')
    .select('*', { count: 'exact', head: true })
    .eq('plant_id', plantId)

  return NextResponse.json({
    plantId,
    availableDates: allDates.length,
    dailySummaryRows: summaryCount ?? 0,
    factStringRows: factCount ?? 0,
    estimatedFactSizeMB: ((factCount ?? 0) * 250) / 1024 / 1024,
    estimatedSummarySizeMB: ((summaryCount ?? 0) * 150) / 1024 / 1024,
  })
}
