/**
 * /api/pr-unavailability
 *
 * POST — Import unavailability events from CSV text
 *   Body: { plantId: string, csv: string }
 *
 * GET  — List events for a plant (optionally filtered by month)
 *   Query: ?plantId=PLT_A&month=2025-05
 *
 * DELETE — Remove a single event by id
 *   Body: { id: number }
 */

import { NextResponse } from 'next/server'
import { createSunalizeClient } from '@/lib/supabase/server'
import { parseUnavailabilityCsv } from '@/features/performance-ratio/lib/etl/parseUnavailabilityCsv'

const BATCH_SIZE = 200

// ---------------------------------------------------------------------------
// POST: Import CSV
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { plantId, csv } = body as { plantId?: string; csv?: string }

    if (!plantId || !csv) {
      return NextResponse.json(
        { error: 'plantId and csv are required' },
        { status: 400 },
      )
    }

    const { events, errors } = parseUnavailabilityCsv(csv, plantId)

    if (events.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: 'No valid events parsed', parseErrors: errors },
        { status: 400 },
      )
    }

    // Upsert in batches
    const supabase = createSunalizeClient()
    let upserted = 0

    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .from('pr_unavailability_events')
        .upsert(batch, { onConflict: 'plant_id,start_ts,end_ts,inverter_id' })

      if (error) {
        return NextResponse.json(
          { error: `Upsert error at batch ${i}: ${error.message}`, upserted },
          { status: 500 },
        )
      }
      upserted += batch.length
    }

    return NextResponse.json({
      message: 'Import complete',
      upserted,
      parseErrors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[pr-unavailability] POST error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET: List events
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const plantId = searchParams.get('plantId')

    if (!plantId) {
      return NextResponse.json({ error: 'plantId is required' }, { status: 400 })
    }

    const supabase = createSunalizeClient()
    let query = supabase
      .from('pr_unavailability_events')
      .select('id, plant_id, start_ts, end_ts, inverter_id, liability, description, imported_at')
      .eq('plant_id', plantId)
      .order('start_ts', { ascending: true })

    const month = searchParams.get('month')
    if (month) {
      const monthStart = `${month}-01 00:00:00`
      const monthEnd = `${month}-31 23:59:59`
      query = query.gte('end_ts', monthStart).lte('start_ts', monthEnd)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ events: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[pr-unavailability] GET error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE: Remove event by id
// ---------------------------------------------------------------------------
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { id } = body as { id?: number }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const supabase = createSunalizeClient()
    const { error } = await supabase
      .from('pr_unavailability_events')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Event deleted', id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[pr-unavailability] DELETE error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
