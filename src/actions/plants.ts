'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOrg } from '@/lib/auth'
import { createPlantSchema, trackerRowSchema } from '@/features/plants/types/schemas'
import type { TrackerRow } from '@/features/plants/types/schemas'

// ============================================
// CREATE PLANT
// ============================================

export async function createPlant(formData: FormData) {
  const ctx = await requireOrg()
  const supabase = await createClient()

  const raw = Object.fromEntries(formData.entries())
  const parsed = createPlantSchema.safeParse(raw)

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const slug = parsed.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50)

  const { data: plant, error } = await supabase
    .from('plants')
    .insert({
      org_id: ctx.orgId,
      slug: `${slug}-${Date.now()}`,
      ...parsed.data,
    })
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  redirect(`/plants/${plant.id}/settings`)
}

// ============================================
// UPDATE PLANT
// ============================================

export async function updatePlant(plantId: string, formData: FormData) {
  await requireOrg()
  const supabase = await createClient()

  const raw = Object.fromEntries(formData.entries())
  const parsed = createPlantSchema.partial().safeParse(raw)

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('plants')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', plantId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/plants/${plantId}`)
  return { success: true }
}

// ============================================
// UPLOAD TRACKERS CSV
// ============================================

export async function uploadTrackersCsv(plantId: string, formData: FormData) {
  const ctx = await requireOrg()
  const supabase = await createClient()

  const file = formData.get('file') as File
  if (!file || file.size === 0) {
    return { error: 'No se selecciono un archivo' }
  }

  const text = await file.text()
  const lines = text.trim().split('\n')

  if (lines.length < 2) {
    return { error: 'El CSV debe tener al menos una fila de datos' }
  }

  // Parse header
  const headerLine = lines[0].trim()
  const separator = headerLine.includes(';') ? ';' : ','
  const headers = headerLine.split(separator).map(h => h.trim())

  const requiredHeaders = ['CT', 'Inverter', 'Tracker', 'String', 'dc_in']
  const missing = requiredHeaders.filter(h => !headers.includes(h))
  if (missing.length > 0) {
    return { error: `Columnas faltantes: ${missing.join(', ')}` }
  }

  // Parse rows
  const rows: TrackerRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].trim().split(separator)
    if (values.length < headers.length) continue

    const rowObj: Record<string, string> = {}
    headers.forEach((h, idx) => { rowObj[h] = values[idx]?.trim() ?? '' })

    const parsed = trackerRowSchema.safeParse(rowObj)
    if (!parsed.success) {
      errors.push(`Fila ${i + 1}: ${parsed.error.issues.map(e => e.message).join(', ')}`)
      if (errors.length >= 5) break
    } else {
      rows.push(parsed.data)
    }
  }

  if (errors.length > 0) {
    return { error: `Errores de validacion:\n${errors.join('\n')}` }
  }

  if (rows.length === 0) {
    return { error: 'No se encontraron filas validas' }
  }

  // Build dim_trackers records
  // Mirrors logic from loader.py: build_string_id, build_svg_id, build_inverter_dc_key
  const dimRows = rows.map(row => {
    const ctId = row.CT.trim()
    const inverterId = row.Inverter.trim()
    const trackerId = row.Tracker.trim()
    const stringLabel = row.String.trim()
    const dcIn = row.dc_in
    const mod = row.module?.toString() ?? null

    // string_id: "CT1-INV 1-1-TRK1-S1"
    const stringId = `${ctId}-${inverterId}-${trackerId}-${stringLabel}`

    // svg_id: "CT1_INV1-1_TRK1_S1" (remove space after INV)
    const inverterSvg = inverterId.replace('INV ', 'INV')
    const svgId = `${ctId}_${inverterSvg}_${trackerId}_${stringLabel}`

    // inverter_dc_key: "INV 1-1|1"
    const inverterDcKey = `${inverterId}|${dcIn}`

    // inverter_base: extract base (e.g., "INV 1" from "INV 1-1")
    const baseMatch = inverterId.match(/^(INV\s*\d+)/)
    const inverterBase = baseMatch ? baseMatch[1] : inverterId

    return {
      org_id: ctx.orgId,
      plant_id: plantId,
      ct_id: ctId,
      inverter_id: inverterId,
      inverter_base: inverterBase,
      tracker_id: trackerId,
      string_label: stringLabel,
      dc_in: dcIn,
      module: mod,
      string_id: stringId,
      svg_id: svgId,
      inverter_dc_key: inverterDcKey,
      peer_group: null as string | null,
    }
  })

  // Compute peer_group: count strings per MPPT, format "2x540"
  const mpptCounts = new Map<string, number>()
  for (const d of dimRows) {
    const key = `${d.inverter_id}|${d.dc_in}`
    mpptCounts.set(key, (mpptCounts.get(key) ?? 0) + 1)
  }
  for (const d of dimRows) {
    const key = `${d.inverter_id}|${d.dc_in}`
    const count = mpptCounts.get(key) ?? 1
    d.peer_group = `${count}x${d.module ?? '?'}`
  }

  // Delete existing trackers for this plant, then insert new ones
  await supabase
    .from('dim_trackers')
    .delete()
    .eq('plant_id', plantId)

  // Insert in batches of 100
  const batchSize = 100
  let totalInserted = 0
  for (let i = 0; i < dimRows.length; i += batchSize) {
    const batch = dimRows.slice(i, i + batchSize)
    const { error: insertErr } = await supabase
      .from('dim_trackers')
      .insert(batch)

    if (insertErr) {
      return { error: `Error insertando batch ${i}: ${insertErr.message}` }
    }
    totalInserted += batch.length
  }

  // Update plant string count and onboarding status
  await supabase
    .from('plants')
    .update({
      string_count: totalInserted,
      inverter_count: new Set(dimRows.map(d => d.inverter_id)).size,
      onboarding_status: 'files_ready',
      updated_at: new Date().toISOString(),
    })
    .eq('id', plantId)

  revalidatePath(`/plants/${plantId}`)
  return { success: true, count: totalInserted }
}

// ============================================
// UPLOAD SVG LAYOUT
// ============================================

export async function uploadSvgLayout(plantId: string, formData: FormData) {
  const ctx = await requireOrg()
  const supabase = await createClient()

  const file = formData.get('file') as File
  if (!file || file.size === 0) {
    return { error: 'No se selecciono un archivo' }
  }

  const svgText = await file.text()

  // Extract <rect> elements with string-like IDs
  // Pattern: id="CT1_INV1-1_TRK1_S1" or similar
  const rectRegex = /<rect[^>]*\bid="([^"]+)"[^>]*>/gi
  const rects: Array<{
    svg_id: string
    x: number | null
    y: number | null
    width: number | null
    height: number | null
  }> = []

  let match: RegExpExecArray | null
  while ((match = rectRegex.exec(svgText)) !== null) {
    const fullTag = match[0]
    const svgId = match[1]

    // Only include rects that look like string IDs
    if (!svgId.includes('_TRK') && !svgId.includes('_S')) continue

    const getAttr = (name: string): number | null => {
      const attrMatch = fullTag.match(new RegExp(`${name}="([^"]+)"`))
      return attrMatch ? parseFloat(attrMatch[1]) : null
    }

    rects.push({
      svg_id: svgId,
      x: getAttr('x'),
      y: getAttr('y'),
      width: getAttr('width'),
      height: getAttr('height'),
    })
  }

  if (rects.length === 0) {
    return { error: 'No se encontraron elementos rect con IDs de strings en el SVG' }
  }

  // Delete existing svg_layout for this plant
  await supabase
    .from('svg_layout')
    .delete()
    .eq('plant_id', plantId)

  // Insert
  const layoutRows = rects.map(r => ({
    org_id: ctx.orgId,
    plant_id: plantId,
    svg_id: r.svg_id,
    tag: 'rect',
    css_class: 'string',
    title: r.svg_id,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
  }))

  const batchSize = 100
  for (let i = 0; i < layoutRows.length; i += batchSize) {
    const batch = layoutRows.slice(i, i + batchSize)
    const { error } = await supabase.from('svg_layout').insert(batch)
    if (error) {
      return { error: `Error insertando SVG layout: ${error.message}` }
    }
  }

  revalidatePath(`/plants/${plantId}`)
  return { success: true, count: rects.length }
}
