/**
 * POST /api/pr-calculate
 *
 * Computes Performance Ratio for a plant and month.
 * Reads raw data from fact tables, runs engine, writes daily/monthly summaries.
 *
 * Body: {
 *   plantId: string,   // e.g. "PLT_A"
 *   month: string,     // "YYYY-MM" e.g. "2025-05"
 *   dryRun?: boolean   // if true, compute but don't write to DB
 * }
 */

import { NextResponse } from 'next/server'
import { computeMonthlyPr } from '@/features/performance-ratio/services/computeMonthlyPr'

interface RequestBody {
  plantId: string
  month: string
  dryRun?: boolean
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody
    const { plantId, month, dryRun } = body

    if (!plantId || !month) {
      return NextResponse.json({ error: 'plantId and month are required' }, { status: 400 })
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month must be YYYY-MM format' }, { status: 400 })
    }

    const result = await computeMonthlyPr(plantId, month, dryRun ?? false)

    return NextResponse.json({
      message: dryRun ? 'Dry run complete' : 'PR calculation complete',
      ...result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[pr-calculate] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
