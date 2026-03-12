'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOrg } from '@/lib/auth'
import { parseScadaCsv, parsePoaCsv } from '@/features/ingestion/lib/etl/parseCsv'
import { buildFactString } from '@/features/ingestion/lib/etl/buildFact'
import type { DimTracker } from '@/features/ingestion/lib/etl/buildFact'
import { z } from 'zod'

const COOLDOWN_MS = 60_000 // 1 minute cooldown between syncs

// ============================================
// MANUAL SYNC — Upload CSVs
// ============================================

const manualSyncSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe ser YYYY-MM-DD'),
})

/**
 * Manual sync: user uploads I_Strings, V_String, and POA CSVs.
 * Creates an ingestion_job, runs ETL, upserts fact_string.
 */
export async function runManualSync(plantId: string, formData: FormData) {
  const ctx = await requireOrg()
  const supabase = await createClient()

  // Validate date
  const dateStr = formData.get('date') as string
  const dateParsed = manualSyncSchema.safeParse({ date: dateStr })
  if (!dateParsed.success) {
    return { error: 'Fecha invalida. Formato: YYYY-MM-DD' }
  }

  // Check plant exists and is ready
  const { data: plant } = await supabase
    .from('plants')
    .select('id, onboarding_status, ct_count')
    .eq('id', plantId)
    .single()

  if (!plant) return { error: 'Planta no encontrada' }

  if (plant.onboarding_status !== 'ready_to_sync' && plant.onboarding_status !== 'active') {
    return { error: 'La planta debe completar el onboarding antes de sincronizar' }
  }

  // Rate limit: check last job
  const { data: lastJob } = await supabase
    .from('ingestion_jobs')
    .select('created_at')
    .eq('plant_id', plantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (lastJob) {
    const elapsed = Date.now() - new Date(lastJob.created_at).getTime()
    if (elapsed < COOLDOWN_MS) {
      return { error: `Espera ${Math.ceil((COOLDOWN_MS - elapsed) / 1000)} segundos antes de lanzar otra sincronizacion` }
    }
  }

  // Check no running job for this plant
  const { count: runningCount } = await supabase
    .from('ingestion_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('plant_id', plantId)
    .eq('status', 'running')

  if ((runningCount ?? 0) > 0) {
    return { error: 'Ya existe una sincronizacion en curso para esta planta' }
  }

  // Get CSV files from form
  const files: Record<string, File> = {}
  for (let ct = 1; ct <= plant.ct_count; ct++) {
    const iFile = formData.get(`i_ct${ct}`) as File | null
    const vFile = formData.get(`v_ct${ct}`) as File | null
    if (iFile && iFile.size > 0) files[`I_CT${ct}`] = iFile
    if (vFile && vFile.size > 0) files[`V_CT${ct}`] = vFile
  }
  const poaFile = formData.get('poa') as File | null

  // At minimum need I_CT1, V_CT1, and POA
  if (!files['I_CT1']) return { error: 'Archivo I_Strings_CT1 es requerido' }
  if (!files['V_CT1']) return { error: 'Archivo V_String_CT1 es requerido' }
  if (!poaFile || poaFile.size === 0) return { error: 'Archivo POA es requerido' }

  // Create job
  const { data: job, error: jobErr } = await supabase
    .from('ingestion_jobs')
    .insert({
      org_id: ctx.orgId,
      plant_id: plantId,
      triggered_by: ctx.userId,
      status: 'running',
      date_start: dateStr,
      date_end: dateStr,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (jobErr || !job) {
    return { error: `Error creando job: ${jobErr?.message}` }
  }

  try {
    // Load dim_trackers for this plant
    const { data: trackers } = await supabase
      .from('dim_trackers')
      .select('ct_id, inverter_id, inverter_base, dc_in, string_id, svg_id, inverter_dc_key, module, peer_group')
      .eq('plant_id', plantId)

    if (!trackers || trackers.length === 0) {
      throw new Error('No hay trackers configurados para esta planta')
    }

    // Parse I CSVs
    const allIRows = []
    for (const [key, file] of Object.entries(files)) {
      if (!key.startsWith('I_')) continue
      const ctId = key.replace('I_', '')
      const text = await file.text()
      allIRows.push(...parseScadaCsv(text, ctId))
    }

    // Parse V CSVs
    const allVRows = []
    for (const [key, file] of Object.entries(files)) {
      if (!key.startsWith('V_')) continue
      const ctId = key.replace('V_', '')
      const text = await file.text()
      allVRows.push(...parseScadaCsv(text, ctId))
    }

    // Parse POA
    const poaText = await poaFile.text()
    const poaRows = parsePoaCsv(poaText)

    // Build fact rows
    const factRows = buildFactString(
      allIRows,
      allVRows,
      poaRows,
      trackers as DimTracker[],
      ctx.orgId,
      plantId,
    )

    if (factRows.length === 0) {
      throw new Error('ETL no produjo registros. Verifica que los CSVs y los trackers coincidan.')
    }

    // Upsert fact_string in batches
    const batchSize = 200
    let totalUpserted = 0

    for (let i = 0; i < factRows.length; i += batchSize) {
      const batch = factRows.slice(i, i + batchSize)
      const { error: upsertErr } = await supabase
        .from('fact_string')
        .upsert(batch, { onConflict: 'plant_id,ts_local,string_id' })

      if (upsertErr) {
        throw new Error(`Error en UPSERT batch ${i}: ${upsertErr.message}`)
      }
      totalUpserted += batch.length
    }

    // Update job as success
    await supabase
      .from('ingestion_jobs')
      .update({
        status: 'success',
        records_loaded: totalUpserted,
        records_expected: trackers.length * 48, // ~48 intervals per day at 30min
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    // Update plant
    await supabase
      .from('plants')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success',
        onboarding_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', plantId)

    revalidatePath(`/plants/${plantId}`)
    return { success: true, count: totalUpserted, jobId: job.id }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido'

    await supabase
      .from('ingestion_jobs')
      .update({
        status: 'error',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    revalidatePath(`/plants/${plantId}`)
    return { error: errorMessage, jobId: job.id }
  }
}
