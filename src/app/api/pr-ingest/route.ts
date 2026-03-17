/**
 * POST /api/pr-ingest
 *
 * Ingest PR data (irradiance + inverter production + meter) into sunalize fact tables.
 *
 * Supports two modes:
 * 1. Day-by-day (webscraper output): reads from Dataset/Raw/YYYY/MM/DD/
 * 2. Bulk (manual Sonnedix files): reads from a custom csvDir path
 *
 * Body: {
 *   plantId: string,          // e.g. "PLT_A"
 *   start: string,            // "YYYY-MM-DD"
 *   end?: string,             // "YYYY-MM-DD" (defaults to start)
 *   dryRun?: boolean,         // if true, parse but don't write
 *   csvDir?: string,          // optional: directory containing Sonnedix CSVs directly
 * }
 *
 * Day-by-day expects files per day:
 *   {RAW_BASE}/{YYYY}/{MM}/{DD}/PR_InverterProduction.csv
 *   {RAW_BASE}/{YYYY}/{MM}/{DD}/PR_MeterReading.csv
 *   {RAW_BASE}/{YYYY}/{MM}/{DD}/PR_Irradiance.csv
 *
 * Bulk mode (csvDir) expects:
 *   {csvDir}/irradiance.csv   (or any file matching "Sonnedix 3" / "Irradiancia")
 *   {csvDir}/production.csv   (or "Sonnedix 1" / "Inversor")
 *   {csvDir}/meter.csv        (or "Sonnedix 2" / "Meter")
 */

import { NextResponse } from 'next/server'
import { createSunalizeClient } from '@/lib/supabase/server'
import { parseIrradianceCsv, cleanIrradianceRows } from '@/features/performance-ratio/lib/etl/parseIrradianceCsv'
import { parseInverterProductionCsv, parseMeterCsv } from '@/features/performance-ratio/lib/etl/parseProductionCsv'
import {
  buildFactIrradiance,
  buildFactInverterProduction,
  buildFactMeterProduction,
} from '@/features/performance-ratio/lib/etl/buildPrFacts'
import type { DimInverter } from '@/features/performance-ratio/types'
import { readFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const RAW_BASE = process.env.DATASET_RAW_PATH
  ?? 'c:\\Users\\jonat\\Jonathan\\Automatizaciones\\Dashboard fotovoltaico\\Supabase\\Dataset\\Raw'

const BATCH_SIZE = 200

interface RequestBody {
  plantId: string
  start: string
  end?: string
  dryRun?: boolean
  csvDir?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody
    const { plantId, start, end, dryRun, csvDir } = body

    if (!plantId || !start) {
      return NextResponse.json({ error: 'plantId and start are required' }, { status: 400 })
    }

    // Load dim_inverters once
    const supabase = createSunalizeClient()
    const { data: inverters, error: invErr } = await supabase
      .from('dim_inverters')
      .select('plant_id, inverter_id, ct_id, peak_power_kwp')
      .eq('plant_id', plantId)

    if (invErr || !inverters || inverters.length === 0) {
      return NextResponse.json(
        { error: `No inverters found for ${plantId}: ${invErr?.message}` },
        { status: 400 },
      )
    }

    const dimInverters: DimInverter[] = inverters

    // Route to bulk or day-by-day mode
    if (csvDir) {
      return handleBulk(supabase, csvDir, plantId, dimInverters, dryRun ?? false)
    }

    return handleDayByDay(supabase, start, end ?? start, plantId, dimInverters, dryRun ?? false)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[pr-ingest] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Bulk mode: read Sonnedix files from a single directory
// ---------------------------------------------------------------------------

async function handleBulk(
  supabase: ReturnType<typeof createSunalizeClient>,
  csvDir: string,
  plantId: string,
  inverters: DimInverter[],
  dryRun: boolean,
) {
  if (!existsSync(csvDir)) {
    return NextResponse.json({ error: `Directory not found: ${csvDir}` }, { status: 400 })
  }

  // Collect all CSV files from dir + subdirectories (1 level deep)
  const allFiles = await collectCsvFiles(csvDir)

  const irradianceFiles = filterFiles(allFiles, ['Sonnedix 3', 'Irradiancia', 'PR_Irradiance', 'irradiance'])
  const productionFiles = filterFiles(allFiles, ['Sonnedix 1', 'PR_InverterProduction', 'production'])
  const meterFiles = filterFiles(allFiles, ['Sonnedix 2', 'Meter', 'PR_MeterReading', 'meter'])

  const stats = { irradiance: 0, production: 0, meter: 0 }

  // Parse & upsert irradiance (typically 1 file)
  if (irradianceFiles.length > 0) {
    for (const filePath of irradianceFiles) {
      const text = await readFile(filePath, 'utf-8')
      const raw = parseIrradianceCsv(text)
      const clean = cleanIrradianceRows(raw)
      const facts = buildFactIrradiance(clean, plantId)
      stats.irradiance += facts.length
      if (!dryRun) {
        await batchUpsert(supabase, 'fact_irradiance', facts, 'plant_id,Fecha')
      }
    }
  }

  // Parse & upsert inverter production (may be split into weekly segments)
  if (productionFiles.length > 0) {
    for (const filePath of productionFiles) {
      const text = await readFile(filePath, 'utf-8')
      const rows = parseInverterProductionCsv(text)
      const facts = buildFactInverterProduction(rows, inverters, plantId)
      stats.production += facts.length
      if (!dryRun) {
        await batchUpsert(supabase, 'fact_inverter_production', facts, 'plant_id,Fecha,inverter_id')
      }
    }
  }

  // Parse & upsert meter (typically 1 file)
  if (meterFiles.length > 0) {
    for (const filePath of meterFiles) {
      const text = await readFile(filePath, 'utf-8')
      const meterRows = parseMeterCsv(text)
      const meterFacts = buildFactMeterProduction(meterRows, plantId)
      stats.meter += meterFacts.length
      if (!dryRun) {
        await batchUpsert(supabase, 'fact_inverter_production', meterFacts, 'plant_id,Fecha,inverter_id')
      }
    }
  }

  return NextResponse.json({
    message: dryRun ? 'Dry run complete (bulk)' : 'Bulk ingestion complete',
    plantId,
    csvDir,
    filesFound: {
      irradiance: irradianceFiles.map(f => f.split(/[/\\]/).pop()),
      production: productionFiles.map(f => f.split(/[/\\]/).pop()),
      meter: meterFiles.map(f => f.split(/[/\\]/).pop()),
    },
    rows: stats,
    total: stats.irradiance + stats.production + stats.meter,
  })
}

// ---------------------------------------------------------------------------
// Day-by-day mode: read from Dataset/Raw/YYYY/MM/DD/
// ---------------------------------------------------------------------------

async function handleDayByDay(
  supabase: ReturnType<typeof createSunalizeClient>,
  start: string,
  end: string,
  plantId: string,
  inverters: DimInverter[],
  dryRun: boolean,
) {
  const dates = generateDateRange(start, end)

  if (dates.length === 0) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }
  if (dates.length > 45) {
    return NextResponse.json({ error: 'Max 45 days per request' }, { status: 400 })
  }

  const results: Array<{ date: string; status: string; rows?: number; error?: string }> = []
  let totalRows = 0

  for (const dateStr of dates) {
    try {
      const dayResult = await processDay(supabase, dateStr, plantId, inverters, dryRun)
      results.push({ date: dateStr, status: dayResult.status, rows: dayResult.rows })
      totalRows += dayResult.rows
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.push({ date: dateStr, status: 'error', error: msg })
    }
  }

  return NextResponse.json({
    message: dryRun ? 'Dry run complete' : 'Ingestion complete',
    plantId,
    range: { start, end },
    totalDays: dates.length,
    totalRows,
    results,
  })
}

async function processDay(
  supabase: ReturnType<typeof createSunalizeClient>,
  dateStr: string,
  plantId: string,
  inverters: DimInverter[],
  dryRun: boolean,
): Promise<{ status: string; rows: number }> {
  const [y, m, d] = dateStr.split('-')
  const dir = join(RAW_BASE, y, m, d)

  if (!existsSync(dir)) {
    return { status: 'skipped_no_dir', rows: 0 }
  }

  let dayRows = 0

  // Irradiance
  const irrPath = join(dir, 'PR_Irradiance.csv')
  if (existsSync(irrPath)) {
    const text = await readFile(irrPath, 'utf-8')
    const raw = parseIrradianceCsv(text)
    const clean = cleanIrradianceRows(raw)
    const facts = buildFactIrradiance(clean, plantId)
    dayRows += facts.length
    if (!dryRun) {
      await batchUpsert(supabase, 'fact_irradiance', facts, 'plant_id,Fecha')
    }
  }

  // Inverter production
  const prodPath = join(dir, 'PR_InverterProduction.csv')
  if (existsSync(prodPath)) {
    const text = await readFile(prodPath, 'utf-8')
    const rows = parseInverterProductionCsv(text)
    const facts = buildFactInverterProduction(rows, inverters, plantId)
    dayRows += facts.length
    if (!dryRun) {
      await batchUpsert(supabase, 'fact_inverter_production', facts, 'plant_id,Fecha,inverter_id')
    }
  }

  // Meter
  const meterPath = join(dir, 'PR_MeterReading.csv')
  if (existsSync(meterPath)) {
    const text = await readFile(meterPath, 'utf-8')
    const meterRows = parseMeterCsv(text)
    const meterFacts = buildFactMeterProduction(meterRows, plantId)
    dayRows += meterFacts.length
    if (!dryRun) {
      await batchUpsert(supabase, 'fact_inverter_production', meterFacts, 'plant_id,Fecha,inverter_id')
    }
  }

  if (dayRows === 0) {
    return { status: 'skipped_no_pr_files', rows: 0 }
  }

  return { status: dryRun ? 'dry_run' : 'success', rows: dayRows }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function batchUpsert(
  supabase: ReturnType<typeof createSunalizeClient>,
  table: string,
  rows: unknown[],
  onConflict: string,
) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from(table)
      .upsert(batch as Record<string, unknown>[], { onConflict })

    if (error) {
      throw new Error(`Upsert error on ${table} at batch ${i}: ${error.message}`)
    }
  }
}

/** Collect all .csv files from dir and immediate subdirectories. */
async function collectCsvFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const csvFiles: string[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
      csvFiles.push(fullPath)
    } else if (entry.isDirectory()) {
      const subEntries = await readdir(fullPath, { withFileTypes: true })
      for (const sub of subEntries) {
        if (sub.isFile() && sub.name.toLowerCase().endsWith('.csv')) {
          csvFiles.push(join(fullPath, sub.name))
        }
      }
    }
  }

  return csvFiles
}

/** Filter file paths matching any of the patterns (case-insensitive). */
function filterFiles(files: string[], patterns: string[]): string[] {
  return files.filter(f => {
    const name = f.split(/[/\\]/).pop()?.toLowerCase() ?? ''
    return patterns.some(p => name.includes(p.toLowerCase()))
  })
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
