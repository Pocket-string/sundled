import { createSunalizeClient } from '@/lib/supabase/server'

export interface StringReading {
  string_id: string
  svg_id: string | null
  inverter_id: string | null
  peer_group: string | null
  i_string: number | null
  v_string: number | null
  p_string: number | null
  poa: number | null
  t_mod: number | null
  status: 'green' | 'blue' | 'orange' | 'red' | 'gray'
  underperf_ratio: number | null
}

export interface PlantDashboardData {
  lastTimestamp: string | null
  totalStrings: number
  stringsWithData: number
  stringsUnderThreshold: number
  avgPoa: number | null
  readings: StringReading[]
}

// Map SaaS plant UUID to legacy plant_id in sunalize schema
// TODO: Replace with proper mapping table when migration is complete
const LEGACY_PLANT_MAP: Record<string, string> = {}

async function getLegacyPlantId(plantId: string): Promise<string> {
  // If it's already a legacy ID (e.g. "PLT_A"), use directly
  if (plantId.startsWith('PLT_')) return plantId
  // Check mapping
  return LEGACY_PLANT_MAP[plantId] ?? 'PLT_A'
}

/**
 * Fetch latest timestamp readings for a plant and compute underperformance.
 *
 * Reads from the legacy "sunalize" schema where existing Power BI data lives.
 * Key differences from SaaS schema:
 * - Column "Fecha" instead of "ts_local"
 * - No org_id (single-tenant)
 * - plant_id is text like "PLT_A" not UUID
 */
export async function getPlantDashboard(plantId: string): Promise<PlantDashboardData> {
  const supabase = createSunalizeClient()
  const legacyId = await getLegacyPlantId(plantId)

  // Get the latest DAYTIME timestamp (POA > 50 W/m²) for this plant
  // sunalize.fact_string uses "Fecha" column
  const { data: latest } = await supabase
    .from('fact_string')
    .select('Fecha')
    .eq('plant_id', legacyId)
    .gt('poa', 50)
    .order('Fecha', { ascending: false })
    .limit(1)
    .single()

  if (!latest) {
    const { count } = await supabase
      .from('dim_trackers')
      .select('*', { count: 'exact', head: true })
      .eq('plant_id', legacyId)

    return {
      lastTimestamp: null,
      totalStrings: count ?? 0,
      stringsWithData: 0,
      stringsUnderThreshold: 0,
      avgPoa: null,
      readings: [],
    }
  }

  // Get all readings at latest timestamp
  const { data: rows } = await supabase
    .from('fact_string')
    .select('string_id, svg_id, inverter_id, peer_group, i_string, v_string, p_string, poa, t_mod')
    .eq('plant_id', legacyId)
    .eq('Fecha', latest.Fecha)

  const { count: totalStrings } = await supabase
    .from('dim_trackers')
    .select('*', { count: 'exact', head: true })
    .eq('plant_id', legacyId)

  if (!rows || rows.length === 0) {
    return {
      lastTimestamp: latest.Fecha,
      totalStrings: totalStrings ?? 0,
      stringsWithData: 0,
      stringsUnderThreshold: 0,
      avgPoa: null,
      readings: [],
    }
  }

  // Compute median P per peer_group
  const peerGroupValues = new Map<string, number[]>()
  for (const row of rows) {
    if (row.p_string !== null && !isNaN(row.p_string) && row.peer_group) {
      const arr = peerGroupValues.get(row.peer_group) ?? []
      arr.push(row.p_string)
      peerGroupValues.set(row.peer_group, arr)
    }
  }

  const peerMedians = new Map<string, number>()
  for (const [group, values] of peerGroupValues) {
    values.sort((a, b) => a - b)
    const mid = Math.floor(values.length / 2)
    const median = values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid]
    peerMedians.set(group, median)
  }

  // Classify each string
  const readings: StringReading[] = rows.map(row => {
    let status: StringReading['status'] = 'gray'
    let underperfRatio: number | null = null

    if (row.p_string !== null && !isNaN(row.p_string) && row.peer_group) {
      const median = peerMedians.get(row.peer_group)
      if (median && median > 0) {
        underperfRatio = row.p_string / median
        if (underperfRatio >= 0.95) status = 'green'
        else if (underperfRatio >= 0.80) status = 'blue'
        else if (underperfRatio >= 0.60) status = 'orange'
        else status = 'red'
      }
    }

    // Sanitize NaN values from Postgres (come as "NaN" strings via JSON)
    const clean = (v: number | null) => (v !== null && !isNaN(v) ? v : null)

    return {
      string_id: row.string_id,
      svg_id: row.svg_id,
      inverter_id: row.inverter_id,
      peer_group: row.peer_group,
      i_string: clean(row.i_string),
      v_string: clean(row.v_string),
      p_string: clean(row.p_string),
      poa: clean(row.poa),
      t_mod: clean(row.t_mod),
      status,
      underperf_ratio: underperfRatio,
    }
  })

  const stringsWithData = readings.filter(r => r.p_string !== null).length
  const stringsUnderThreshold = readings.filter(r => r.status === 'red' || r.status === 'orange' || r.status === 'blue').length
  const poaValues = readings.filter(r => r.poa !== null).map(r => r.poa!)
  const avgPoa = poaValues.length > 0 ? poaValues.reduce((a, b) => a + b, 0) / poaValues.length : null

  return {
    lastTimestamp: latest.Fecha,
    totalStrings: totalStrings ?? 0,
    stringsWithData,
    stringsUnderThreshold,
    avgPoa,
    readings,
  }
}
