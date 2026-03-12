import { createSunalizeClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseModuleW } from '@/features/analytics/lib/engine'

export async function GET() {
  const supabase = createSunalizeClient()
  const plantId = 'PLT_A'
  const debug: Record<string, unknown> = {}

  // 1. Check what dates exist
  const { data: latestRow, error: e1 } = await supabase
    .from('fact_string')
    .select('Fecha, poa, p_string, string_id')
    .eq('plant_id', plantId)
    .gt('poa', 50)
    .order('Fecha', { ascending: false })
    .limit(1)
    .single()

  debug.latestRow = latestRow
  debug.latestRowError = e1?.message ?? null

  if (!latestRow) {
    return NextResponse.json({ error: 'No data found', debug })
  }

  const date = String(latestRow.Fecha).substring(0, 10)
  debug.date = date

  // 2. Check the main query (same as getAnalyticsSnapshotDemo)
  const dateStart = `${date}T00:00:00`
  const dateEnd = `${date}T23:59:59`

  const { data: allDayRaw, error: e2 } = await supabase
    .from('fact_string')
    .select('string_id, svg_id, inverter_id, peer_group, poa, t_mod, i_string, v_string, p_string, Fecha')
    .eq('plant_id', plantId)
    .gte('Fecha', dateStart)
    .lte('Fecha', dateEnd)
    .gt('p_string', 0)
    .order('Fecha', { ascending: true })
    .limit(10)

  debug.mainQueryError = e2?.message ?? null
  debug.mainQueryRowCount = allDayRaw?.length ?? 0
  debug.mainQuerySample = allDayRaw?.slice(0, 3) ?? []

  // 3. Check if peer_group exists and what values it has
  const { data: peerSample, error: e3 } = await supabase
    .from('fact_string')
    .select('string_id, peer_group')
    .eq('plant_id', plantId)
    .not('peer_group', 'is', null)
    .limit(5)

  debug.peerGroupError = e3?.message ?? null
  debug.peerGroupSample = peerSample ?? []
  debug.peerGroupParsed = (peerSample ?? []).map(r => ({
    string_id: r.string_id,
    peer_group: r.peer_group,
    module_w: parseModuleW(r.peer_group)
  }))

  // 4. Try query WITHOUT peer_group/svg_id/inverter_id to see if those cause error
  const { data: minimalQuery, error: e4 } = await supabase
    .from('fact_string')
    .select('string_id, poa, p_string, Fecha')
    .eq('plant_id', plantId)
    .gte('Fecha', dateStart)
    .lte('Fecha', dateEnd)
    .gt('p_string', 0)
    .limit(5)

  debug.minimalQueryError = e4?.message ?? null
  debug.minimalQueryRowCount = minimalQuery?.length ?? 0
  debug.minimalQuerySample = minimalQuery ?? []

  // 5. Check POA distribution for the date
  const { data: poaSample, error: e5 } = await supabase
    .from('fact_string')
    .select('Fecha, poa')
    .eq('plant_id', plantId)
    .eq('string_id', latestRow.string_id)
    .gte('Fecha', dateStart)
    .lte('Fecha', dateEnd)
    .order('Fecha', { ascending: true })

  debug.poaDistError = e5?.message ?? null
  debug.poaTimestamps = (poaSample ?? []).map(r => ({
    ts: r.Fecha,
    poa: r.poa
  }))

  // 6. Check dim_trackers peer_group
  const { data: trackerSample, error: e6 } = await supabase
    .from('dim_trackers')
    .select('string_id, peer_group, module, svg_id')
    .eq('plant_id', plantId)
    .limit(5)

  debug.trackerError = e6?.message ?? null
  debug.trackerSample = trackerSample ?? []

  // 7. Check midday data specifically (peak POA timestamps)
  const { data: middayRows, error: e7 } = await supabase
    .from('fact_string')
    .select('string_id, peer_group, poa, p_string, Fecha')
    .eq('plant_id', plantId)
    .gte('Fecha', `${date}T12:00:00`)
    .lte('Fecha', `${date}T12:30:00`)
    .limit(10)

  debug.middayError = e7?.message ?? null
  debug.middayRowCount = middayRows?.length ?? 0
  debug.middaySample = (middayRows ?? []).slice(0, 5).map(r => ({
    string_id: r.string_id,
    peer_group: r.peer_group,
    poa: r.poa,
    p_string: r.p_string,
    p_string_type: typeof r.p_string,
    p_string_isNaN: r.p_string === 'NaN' || Number.isNaN(Number(r.p_string)),
    Fecha: r.Fecha,
  }))

  // 8. Count how many rows have valid (non-NaN) p_string at midday
  const { data: validMidday, error: e8 } = await supabase
    .from('fact_string')
    .select('string_id, p_string, poa')
    .eq('plant_id', plantId)
    .gte('Fecha', `${date}T12:00:00`)
    .lte('Fecha', `${date}T12:00:00`)
    .not('p_string', 'eq', 'NaN')
    .limit(10)

  debug.validMiddayError = e8?.message ?? null
  debug.validMiddayCount = validMidday?.length ?? 0
  debug.validMiddaySample = validMidday?.slice(0, 5) ?? []

  // 9. Try the algorithm simulation
  const { data: fullDay } = await supabase
    .from('fact_string')
    .select('string_id, peer_group, poa, p_string, Fecha')
    .eq('plant_id', plantId)
    .gte('Fecha', `${date}T10:00:00`)
    .lte('Fecha', `${date}T14:00:00`)
    .limit(50000)

  const validRows = (fullDay ?? []).filter(r => {
    const p = Number(r.p_string)
    const poa = Number(r.poa)
    return !isNaN(p) && p > 0 && !isNaN(poa) && poa > 0
  })
  debug.totalRowsFrom10to14 = fullDay?.length ?? 0
  debug.validRowsFrom10to14 = validRows.length
  debug.validSample = validRows.slice(0, 5).map(r => ({
    string_id: r.string_id,
    peer_group: r.peer_group,
    poa: r.poa,
    p_string: r.p_string,
    Fecha: r.Fecha,
  }))

  // 10. Check CT2_INV2-1_TRK2 string mappings
  const { data: trk2Strings } = await supabase
    .from('dim_trackers')
    .select('string_id, svg_id, peer_group, dc_in')
    .eq('plant_id', plantId)
    .like('string_id', 'CT2-INV 2-1-TRK2%')

  debug.trk2Mappings = trk2Strings ?? []

  // 11. Check fact_string svg_id for CT2-INV 2-1-TRK2-S3 at midday
  const { data: s3FactRow } = await supabase
    .from('fact_string')
    .select('string_id, svg_id, p_string, poa, Fecha')
    .eq('plant_id', plantId)
    .eq('string_id', 'CT2-INV 2-1-TRK2-S3')
    .gte('Fecha', `${date}T12:00:00`)
    .lte('Fecha', `${date}T12:30:00`)
    .limit(1)
    .single()

  debug.s3FactRow = s3FactRow ?? null

  // 12. Check svg_layout for CT2_INV2-1_TRK2 rects
  const { data: trk2Layout } = await supabase
    .from('svg_layout')
    .select('svg_id, x, y, width, height')
    .eq('plant_id', plantId)
    .like('svg_id', 'CT2_INV2-1_TRK2%')

  debug.trk2Layout = trk2Layout ?? []

  // 13. Count strings with null peer_group at a peak timestamp
  const peakTs = debug.poaTimestamps
    ? (debug.poaTimestamps as { ts: string; poa: number }[])
        .filter(t => t.poa > 1000)
        .map(t => t.ts)[0]
    : null

  if (peakTs) {
    const { data: peakRows } = await supabase
      .from('fact_string')
      .select('string_id, peer_group, poa, p_string')
      .eq('plant_id', plantId)
      .eq('Fecha', peakTs)
      .limit(1000)

    const rows = peakRows ?? []
    debug.peakTs = peakTs
    debug.peakTotalStrings = rows.length

    let nullPeerGroup = 0
    let nullPstring = 0
    let nanPstring = 0
    let nullPoa = 0
    let nanPoa = 0
    let parseFailPeerGroup = 0
    const peerGroupValues = new Map<string, number>()

    for (const r of rows) {
      if (r.peer_group === null) nullPeerGroup++
      else {
        peerGroupValues.set(r.peer_group, (peerGroupValues.get(r.peer_group) ?? 0) + 1)
        if (parseModuleW(r.peer_group) === null) parseFailPeerGroup++
      }
      const p = Number(r.p_string)
      const poa = Number(r.poa)
      if (r.p_string === null) nullPstring++
      else if (isNaN(p)) nanPstring++
      if (r.poa === null) nullPoa++
      else if (isNaN(poa)) nanPoa++
    }

    debug.peakBreakdown = {
      totalRows: rows.length,
      nullPeerGroup,
      parseFailPeerGroup,
      nullPstring,
      nanPstring,
      nullPoa,
      nanPoa,
      peerGroupDistribution: Object.fromEntries(peerGroupValues),
    }

    // Count how many would pass all filters
    let passAll = 0
    for (const r of rows) {
      const p = Number(r.p_string)
      const poa = Number(r.poa)
      if (isNaN(p) || p <= 0) continue
      if (isNaN(poa) || poa <= 0) continue
      const mw = parseModuleW(r.peer_group)
      if (mw === null) continue
      passAll++
    }
    debug.peakPassAllFilters = passAll
    debug.peakExcluded = rows.length - passAll
  }

  return NextResponse.json(debug, { status: 200 })
}
