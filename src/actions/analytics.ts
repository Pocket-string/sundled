'use server'

import { revalidatePath } from 'next/cache'
import { requireOrg, requireRole } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { rebuildAnalyticsSchema } from '@/features/analytics/schemas'
import { computeAllSnapshots, isEligible } from '@/features/analytics/lib/engine'
import type { FactRow } from '@/features/analytics/types'

interface RebuildResult {
  success: boolean
  error?: string
  snapshotsCreated?: number
  timestampsProcessed?: number
}

/**
 * Rebuild analytics snapshots for a plant within a date range (max 7 days).
 * Requires owner/admin/operator role.
 */
export async function rebuildAnalytics(formData: FormData): Promise<RebuildResult> {
  // Auth
  const org = await requireOrg()
  await requireRole(['owner', 'admin', 'operator'])

  // Validate input
  const raw = {
    plantId: formData.get('plantId') as string,
    dateStart: formData.get('dateStart') as string,
    dateEnd: formData.get('dateEnd') as string,
  }

  const parsed = rebuildAnalyticsSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const { plantId, dateStart, dateEnd } = parsed.data
  const supabase = await createClient()

  // Verify plant belongs to org
  const { data: plant } = await supabase
    .from('plants')
    .select('id')
    .eq('id', plantId)
    .single()

  if (!plant) {
    return { success: false, error: 'Planta no encontrada' }
  }

  // Get all daytime timestamps in range
  const { data: timestamps } = await supabase
    .from('fact_string')
    .select('ts_local')
    .eq('plant_id', plantId)
    .gte('ts_local', `${dateStart}T00:00:00`)
    .lte('ts_local', `${dateEnd}T23:59:59`)
    .gt('poa', 50)
    .order('ts_local', { ascending: true })
    .limit(10000)

  if (!timestamps || timestamps.length === 0) {
    return { success: false, error: 'Sin datos diurnos en el rango seleccionado' }
  }

  // Get unique timestamps
  const uniqueTs = [...new Set(timestamps.map((t) => t.ts_local))]

  // Fetch 30-day history (before dateStart) for all strings
  const thirtyBefore = new Date(new Date(dateStart).getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .substring(0, 19)

  const { data: historyRaw } = await supabase
    .from('fact_string')
    .select('string_id, poa, p_string, ts_local')
    .eq('plant_id', plantId)
    .gte('ts_local', thirtyBefore)
    .lt('ts_local', `${dateStart}T00:00:00`)
    .gt('poa', 200)
    .gt('p_string', 0)
    .limit(100000)

  const historyByString = new Map<string, FactRow[]>()
  if (historyRaw) {
    for (const r of historyRaw) {
      const arr = historyByString.get(r.string_id) ?? []
      arr.push({
        string_id: r.string_id,
        poa: r.poa,
        p_string: r.p_string,
        i_string: null,
        v_string: null,
        ts: r.ts_local,
      })
      historyByString.set(r.string_id, arr)
    }
  }

  // Process each timestamp
  const serviceClient = createServiceClient()
  let totalSnapshots = 0

  for (const ts of uniqueTs) {
    const { data: currentRaw } = await supabase
      .from('fact_string')
      .select('string_id, svg_id, inverter_id, peer_group, poa, t_mod, i_string, v_string, p_string, ts_utc')
      .eq('plant_id', plantId)
      .eq('ts_local', ts)

    if (!currentRaw || currentRaw.length === 0) continue

    const currentRows: FactRow[] = currentRaw.map((r) => ({
      string_id: r.string_id,
      svg_id: r.svg_id,
      inverter_id: r.inverter_id,
      peer_group: r.peer_group,
      poa: r.poa,
      t_mod: r.t_mod,
      i_string: r.i_string,
      v_string: r.v_string,
      p_string: r.p_string,
      ts: ts,
    }))

    const tsUtc = currentRaw[0].ts_utc ?? ts

    const snapshots = computeAllSnapshots({
      plantId,
      tsUtc,
      tsLocal: ts,
      currentRows,
      historyByString,
    })

    // Batch UPSERT (200 at a time)
    const rows = snapshots.map((s) => ({
      ...s,
      org_id: org.orgId,
      computed_at: new Date().toISOString(),
    }))

    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200)
      const { error } = await serviceClient
        .from('string_analytics_snapshots')
        .upsert(batch, { onConflict: 'plant_id,string_id,ts_utc' })

      if (error) {
        console.error('UPSERT error:', error)
        return {
          success: false,
          error: `Error al guardar snapshots: ${error.message}`,
          snapshotsCreated: totalSnapshots,
          timestampsProcessed: uniqueTs.indexOf(ts),
        }
      }

      totalSnapshots += batch.length
    }

    // Also accumulate history for subsequent timestamps in the range
    for (const row of currentRows) {
      if (isEligible(row)) {
        const arr = historyByString.get(row.string_id) ?? []
        arr.push(row)
        historyByString.set(row.string_id, arr)
      }
    }
  }

  revalidatePath(`/plants/${plantId}`)

  return {
    success: true,
    snapshotsCreated: totalSnapshots,
    timestampsProcessed: uniqueTs.length,
  }
}
