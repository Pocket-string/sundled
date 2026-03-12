import { NextResponse } from 'next/server'
import { createSunalizeClient } from '@/lib/supabase/server'
import { parseScadaCsv, parsePoaCsv } from '@/features/ingestion/lib/etl/parseCsv'
import { buildFactString } from '@/features/ingestion/lib/etl/buildFact'
import type { DimTracker } from '@/features/ingestion/lib/etl/buildFact'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

// Base path for raw CSV files (webscraper output)
const RAW_BASE = process.env.DATASET_RAW_PATH
  ?? 'c:\\Users\\jonat\\Jonathan\\Automatizaciones\\Dashboard fotovoltaico\\Supabase\\Dataset\\Raw'

const CT_COUNT = 3
const BATCH_SIZE = 200

/**
 * POST /api/ingest
 *
 * Batch-load CSV data from Dataset/Raw/ into sunalize.fact_string.
 *
 * Body: {
 *   plantId: string,        // e.g. "PLT_A"
 *   start: string,          // "YYYY-MM-DD"
 *   end?: string,           // "YYYY-MM-DD" (defaults to start)
 *   dryRun?: boolean        // if true, parse but don't write
 * }
 *
 * Usage:
 *   curl -X POST http://localhost:3000/api/ingest \
 *     -H 'Content-Type: application/json' \
 *     -d '{"plantId":"PLT_A","start":"2025-10-01","end":"2025-10-13"}'
 */
export async function POST(request: Request) {
  const body = await request.json()
  const { plantId, start, end, dryRun } = body as {
    plantId: string
    start: string
    end?: string
    dryRun?: boolean
  }

  if (!plantId || !start) {
    return NextResponse.json({ error: 'plantId and start are required' }, { status: 400 })
  }

  const endDate = end ?? start
  const dates = generateDateRange(start, endDate)

  if (dates.length === 0) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }

  if (dates.length > 45) {
    return NextResponse.json({ error: 'Max 45 days per request. Use multiple requests for longer ranges.' }, { status: 400 })
  }

  // Load dim_trackers once
  const supabase = createSunalizeClient()
  const { data: trackers, error: trackErr } = await supabase
    .from('dim_trackers')
    .select('ct_id, inverter_id, dc_in, string_id, svg_id, inverter_dc_key, module, peer_group')
    .eq('plant_id', plantId)

  if (trackErr || !trackers || trackers.length === 0) {
    return NextResponse.json({ error: `No trackers found for ${plantId}: ${trackErr?.message}` }, { status: 400 })
  }

  // Add inverter_base for fallback resolution
  const trackersWithBase: DimTracker[] = trackers.map(t => ({
    ...t,
    inverter_base: t.inverter_id?.match(/^(INV\s*\d+)/)?.[1] ?? null,
  }))

  const results: Array<{ date: string; status: string; rows?: number; error?: string }> = []
  let totalUpserted = 0

  for (const dateStr of dates) {
    try {
      const dayResult = await processDay(supabase, dateStr, plantId, trackersWithBase, dryRun ?? false)
      results.push({ date: dateStr, status: dayResult.status, rows: dayResult.rows })
      totalUpserted += dayResult.rows
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.push({ date: dateStr, status: 'error', error: msg })
    }
  }

  return NextResponse.json({
    message: dryRun ? 'Dry run complete' : 'Ingestion complete',
    plantId,
    range: { start, end: endDate },
    totalDays: dates.length,
    totalRows: totalUpserted,
    results,
  })
}

/**
 * GET /api/ingest?path=YYYY/MM/DD
 *
 * Check if CSV files exist for a given date path.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const datePath = url.searchParams.get('date')

  if (datePath) {
    const [y, m, d] = datePath.split('-')
    const dir = join(RAW_BASE, y, m, d)
    const files = {
      I_CT1: existsSync(join(dir, 'I_Strings_CT1.csv')),
      I_CT2: existsSync(join(dir, 'I_Strings_CT2.csv')),
      I_CT3: existsSync(join(dir, 'I_Strings_CT3.csv')),
      V_CT1: existsSync(join(dir, 'V_String_CT1.csv')),
      V_CT2: existsSync(join(dir, 'V_String_CT2.csv')),
      V_CT3: existsSync(join(dir, 'V_String_CT3.csv')),
      POA: existsSync(join(dir, 'POA.csv')),
    }
    return NextResponse.json({ date: datePath, dir, files })
  }

  return NextResponse.json({
    rawBase: RAW_BASE,
    exists: existsSync(RAW_BASE),
    usage: 'GET /api/ingest?date=2025-10-13 — check file availability',
  })
}

// ─── Helpers ───────────────────────────────────────────────────

async function processDay(
  supabase: ReturnType<typeof createSunalizeClient>,
  dateStr: string,
  plantId: string,
  trackers: DimTracker[],
  dryRun: boolean,
): Promise<{ status: string; rows: number }> {
  const [y, m, d] = dateStr.split('-')
  const dir = join(RAW_BASE, y, m, d)

  if (!existsSync(dir)) {
    return { status: 'skipped_no_dir', rows: 0 }
  }

  // Read I CSVs
  const allIRows = []
  for (let ct = 1; ct <= CT_COUNT; ct++) {
    const filePath = join(dir, `I_Strings_CT${ct}.csv`)
    if (!existsSync(filePath)) continue
    const text = await readFile(filePath, 'utf-8')
    allIRows.push(...parseScadaCsv(text, `CT${ct}`))
  }

  // Read V CSVs
  const allVRows = []
  for (let ct = 1; ct <= CT_COUNT; ct++) {
    const filePath = join(dir, `V_String_CT${ct}.csv`)
    if (!existsSync(filePath)) continue
    const text = await readFile(filePath, 'utf-8')
    allVRows.push(...parseScadaCsv(text, `CT${ct}`))
  }

  // Read POA
  const poaPath = join(dir, 'POA.csv')
  if (!existsSync(poaPath)) {
    return { status: 'skipped_no_poa', rows: 0 }
  }
  const poaText = await readFile(poaPath, 'utf-8')
  const poaRows = parsePoaCsv(poaText)

  if (allIRows.length === 0 || allVRows.length === 0) {
    return { status: 'skipped_no_scada', rows: 0 }
  }

  // Build fact rows (uses org_id but sunalize schema doesn't need it)
  const factRows = buildFactString(allIRows, allVRows, poaRows, trackers, '', plantId)

  if (factRows.length === 0) {
    return { status: 'no_matches', rows: 0 }
  }

  if (dryRun) {
    return { status: 'dry_run', rows: factRows.length }
  }

  // Transform to sunalize schema: ts_local → Fecha, remove org_id
  const sunalizeRows = factRows.map(r => ({
    plant_id: r.plant_id,
    Fecha: r.ts_local,
    string_id: r.string_id,
    svg_id: r.svg_id,
    inverter_id: r.inverter_id,
    inverter_dc_key: r.inverter_dc_key,
    dc_in: r.dc_in,
    module: r.module,
    peer_group: r.peer_group,
    i_string: r.i_string,
    v_string: r.v_string,
    p_string: r.p_string,
    poa: r.poa,
    t_mod: r.t_mod,
  }))

  // Batch upsert
  let upserted = 0
  for (let i = 0; i < sunalizeRows.length; i += BATCH_SIZE) {
    const batch = sunalizeRows.slice(i, i + BATCH_SIZE)
    const { error: upsertErr } = await supabase
      .from('fact_string')
      .upsert(batch, { onConflict: 'plant_id,Fecha,string_id' })

    if (upsertErr) {
      throw new Error(`Upsert error at batch ${i}: ${upsertErr.message}`)
    }
    upserted += batch.length
  }

  return { status: 'success', rows: upserted }
}

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const startDate = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return []
  if (startDate > endDate) return []

  const current = new Date(startDate)
  while (current <= endDate) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    current.setDate(current.getDate() + 1)
  }

  return dates
}
