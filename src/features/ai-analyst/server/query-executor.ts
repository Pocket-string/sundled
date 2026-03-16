import { createSunalizeClient } from '@/lib/supabase/server'
import { getAnalyticsSnapshotDemo } from '@/features/analytics/services/getAnalyticsSnapshot'
import { getPlantLossSummaryDemo } from '@/features/analytics/services/getDailySummary'
import { getLatestFullDateDemo } from '@/features/analytics/services/getAvailableDates'
import type { ToolResult } from '../types'

/**
 * queryPlantStatus — Estado general de la planta.
 * Reutiliza: getAnalyticsSnapshotDemo + getPlantLossSummaryDemo + energy aggregation
 */
export async function executePlantStatus(params: {
  plant_id: string
  date?: string
  period: 'today' | 'last_7d' | 'last_30d'
}): Promise<ToolResult> {
  try {
    const days = params.period === 'today' ? 1 : params.period === 'last_7d' ? 7 : 30
    const latestDate = await getLatestFullDateDemo(params.plant_id)
    const date = params.date ?? latestDate ?? undefined
    const dateEnd = date ?? new Date().toISOString().split('T')[0]
    const dateStart = subtractDays(dateEnd, days)

    const supabase = createSunalizeClient()

    const [snapshot, lossSummary, energyData] = await Promise.all([
      getAnalyticsSnapshotDemo(params.plant_id, date),
      getPlantLossSummaryDemo(params.plant_id, days),
      // Fetch generation + loss totals from daily_string_summary
      supabase
        .from('daily_string_summary')
        .select('p_string_avg, p_expected_avg, energy_loss_wh, peak_intervals')
        .eq('plant_id', params.plant_id)
        .gte('date', dateStart)
        .lte('date', dateEnd)
        .limit(5000),
    ])

    // Calculate total generation and expected from daily_string_summary
    let totalGenerationWh = 0
    let totalExpectedWh = 0
    let totalLossWh = 0
    const rows = energyData.data ?? []
    for (const row of rows) {
      const intervals = Number(row.peak_intervals) || 1
      // p_string_avg is avg power during peak intervals (W), convert to Wh
      // Each interval = 10 min = 1/6 hour
      const hoursPerInterval = 10 / 60
      totalGenerationWh += (Number(row.p_string_avg) || 0) * intervals * hoursPerInterval
      totalExpectedWh += (Number(row.p_expected_avg) || 0) * intervals * hoursPerInterval
      totalLossWh += Number(row.energy_loss_wh) || 0
    }

    const totalGenerationKwh = Math.round(totalGenerationWh / 10) / 100
    const totalExpectedKwh = Math.round(totalExpectedWh / 10) / 100
    const totalLossKwh = Math.round(totalLossWh / 10) / 100
    const lossPercentage = totalExpectedKwh > 0
      ? Math.round((totalLossKwh / totalExpectedKwh) * 10000) / 100
      : null

    return {
      success: true,
      source: 'daily_string_summary + fact_string (peak energy)',
      dateRange: { start: lossSummary.dateStart ?? dateStart, end: lossSummary.dateEnd ?? dateEnd },
      data: {
        date: snapshot.date,
        analysisMode: snapshot.analysisMode,
        totalStrings: snapshot.totalStrings,
        distribution: {
          green: snapshot.greenCount,
          blue: snapshot.blueCount,
          orange: snapshot.orangeCount,
          red: snapshot.redCount,
          gray: snapshot.grayCount,
        },
        avgPoa: snapshot.avgPoa ? Math.round(snapshot.avgPoa) : null,
        energy: {
          totalGenerationKwh,
          totalExpectedKwh,
          totalLossKwh,
          lossPercentage,
          daysAnalyzed: lossSummary.daysAnalyzed,
          recordsAnalyzed: rows.length,
        },
        loss: {
          totalKwh: lossSummary.totalLossKwh,
          stringsUnderperforming: lossSummary.stringsUnderperforming,
          avgLossPerStringWh: lossSummary.avgLossPerStringWh,
          daysAnalyzed: lossSummary.daysAnalyzed,
        },
      },
    }
  } catch (error) {
    return {
      success: false,
      source: 'executePlantStatus',
      data: null,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * queryTopUnderperformers — Top N strings/inversores con peor rendimiento.
 * Query directa a daily_string_summary, agrupada si entity_type = 'inverter'.
 */
export async function executeTopUnderperformers(params: {
  plant_id: string
  entity_type: 'string' | 'inverter'
  metric: 'energy_loss_wh' | 'underperf_ratio'
  date_start?: string
  date_end?: string
  limit: number
}): Promise<ToolResult> {
  try {
    const supabase = createSunalizeClient()
    const latestDate = await getLatestFullDateDemo(params.plant_id)
    const dateEnd = params.date_end ?? latestDate ?? new Date().toISOString().split('T')[0]
    const dateStart = params.date_start ?? subtractDays(dateEnd, 7)

    let query = supabase
      .from('daily_string_summary')
      .select('string_id, inverter_id, class, energy_loss_wh, underperf_ratio, date, p_string_avg, p_expected_avg')
      .eq('plant_id', params.plant_id)
      .gte('date', dateStart)
      .lte('date', dateEnd)

    // Filter to underperforming only
    query = query.in('class', ['orange', 'red'])

    const { data, error } = await query.order('date', { ascending: false }).limit(5000)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) {
      return {
        success: true,
        source: 'daily_string_summary',
        dateRange: { start: dateStart, end: dateEnd },
        data: { results: [], message: 'No se encontraron strings con bajo rendimiento en este periodo.' },
      }
    }

    let results: Record<string, unknown>[]

    if (params.entity_type === 'inverter') {
      // Aggregate by inverter
      const byInverter = new Map<string, { totalLoss: number; count: number; avgRatio: number; ratioCount: number; strings: Set<string> }>()
      for (const row of data) {
        const inv = row.inverter_id ?? 'unknown'
        const entry = byInverter.get(inv) ?? { totalLoss: 0, count: 0, avgRatio: 0, ratioCount: 0, strings: new Set<string>() }
        entry.totalLoss += Number(row.energy_loss_wh) || 0
        entry.count++
        entry.strings.add(row.string_id)
        if (row.underperf_ratio !== null) {
          entry.avgRatio += Number(row.underperf_ratio)
          entry.ratioCount++
        }
        byInverter.set(inv, entry)
      }

      results = Array.from(byInverter.entries())
        .map(([inv, e]) => ({
          inverter_id: inv,
          total_loss_wh: Math.round(e.totalLoss),
          avg_ratio: e.ratioCount > 0 ? Math.round((e.avgRatio / e.ratioCount) * 1000) / 1000 : null,
          underperforming_strings: e.strings.size,
          days_with_loss: e.count,
        }))
        .sort((a, b) =>
          params.metric === 'energy_loss_wh'
            ? b.total_loss_wh - a.total_loss_wh
            : (a.avg_ratio ?? 1) - (b.avg_ratio ?? 1)
        )
        .slice(0, params.limit)
    } else {
      // Aggregate by string
      const byString = new Map<string, { totalLoss: number; avgRatio: number; ratioCount: number; inverter: string; count: number }>()
      for (const row of data) {
        const sid = row.string_id
        const entry = byString.get(sid) ?? { totalLoss: 0, avgRatio: 0, ratioCount: 0, inverter: row.inverter_id ?? '', count: 0 }
        entry.totalLoss += Number(row.energy_loss_wh) || 0
        entry.count++
        if (row.underperf_ratio !== null) {
          entry.avgRatio += Number(row.underperf_ratio)
          entry.ratioCount++
        }
        byString.set(sid, entry)
      }

      results = Array.from(byString.entries())
        .map(([sid, e]) => ({
          string_id: sid,
          inverter_id: e.inverter,
          total_loss_wh: Math.round(e.totalLoss),
          avg_ratio: e.ratioCount > 0 ? Math.round((e.avgRatio / e.ratioCount) * 1000) / 1000 : null,
          days_underperforming: e.count,
        }))
        .sort((a, b) =>
          params.metric === 'energy_loss_wh'
            ? b.total_loss_wh - a.total_loss_wh
            : (a.avg_ratio ?? 1) - (b.avg_ratio ?? 1)
        )
        .slice(0, params.limit)
    }

    return {
      success: true,
      source: 'daily_string_summary',
      dateRange: { start: dateStart, end: dateEnd },
      data: { results, totalRecordsAnalyzed: data.length },
    }
  } catch (error) {
    return {
      success: false,
      source: 'executeTopUnderperformers',
      data: null,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * compareEntities — Compara dos inversores, strings o periodos.
 * Dos queries paralelas a daily_string_summary.
 */
export async function executeCompareEntities(params: {
  plant_id: string
  comparison_type: 'strings' | 'inverters' | 'periods'
  entity_a: string
  entity_b: string
  date_start?: string
  date_end?: string
  metrics: string[]
}): Promise<ToolResult> {
  try {
    const supabase = createSunalizeClient()
    const latestDate = await getLatestFullDateDemo(params.plant_id)
    const dateEnd = params.date_end ?? latestDate ?? new Date().toISOString().split('T')[0]
    const dateStart = params.date_start ?? subtractDays(dateEnd, 7)

    const filterField = params.comparison_type === 'inverters' ? 'inverter_id' : 'string_id'

    if (params.comparison_type === 'periods') {
      // Compare same plant across two date ranges
      const [dataA, dataB] = await Promise.all([
        queryDailySummary(supabase, params.plant_id, params.entity_a, subtractDays(params.entity_a, 7)),
        queryDailySummary(supabase, params.plant_id, params.entity_b, subtractDays(params.entity_b, 7)),
      ])

      return {
        success: true,
        source: 'daily_string_summary',
        dateRange: { start: params.entity_a, end: params.entity_b },
        data: {
          period_a: { date: params.entity_a, ...aggregateSummary(dataA) },
          period_b: { date: params.entity_b, ...aggregateSummary(dataB) },
        },
      }
    }

    // Compare two entities (strings or inverters) in same date range
    const [dataA, dataB] = await Promise.all([
      queryDailySummaryByEntity(supabase, params.plant_id, filterField, params.entity_a, dateStart, dateEnd),
      queryDailySummaryByEntity(supabase, params.plant_id, filterField, params.entity_b, dateStart, dateEnd),
    ])

    return {
      success: true,
      source: 'daily_string_summary',
      dateRange: { start: dateStart, end: dateEnd },
      data: {
        entity_a: { id: params.entity_a, ...aggregateSummary(dataA) },
        entity_b: { id: params.entity_b, ...aggregateSummary(dataB) },
      },
    }
  } catch (error) {
    return {
      success: false,
      source: 'executeCompareEntities',
      data: null,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * queryRecentDetail — Detalle granular desde fact_string.
 * Hard limits: max 48h, max 200 rows.
 */
export async function executeRecentDetail(params: {
  plant_id: string
  entity_type: 'string' | 'inverter'
  entity_id: string
  date_start: string
  date_end: string
}): Promise<ToolResult> {
  try {
    // Enforce 48h max range
    const start = new Date(params.date_start)
    const end = new Date(params.date_end)
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    if (diffHours > 48) {
      return {
        success: false,
        source: 'fact_string',
        data: null,
        error: 'El rango maximo para detalle granular es 48 horas. Usa un rango mas corto.',
      }
    }

    const supabase = createSunalizeClient()
    const filterField = params.entity_type === 'string' ? 'string_id' : 'inverter_id'

    const { data, error } = await supabase
      .from('fact_string')
      .select('"Fecha", string_id, inverter_id, i_string, v_string, p_string, poa, t_mod')
      .eq('plant_id', params.plant_id)
      .eq(filterField, params.entity_id)
      .gte('"Fecha"', params.date_start)
      .lte('"Fecha"', params.date_end)
      .order('"Fecha"', { ascending: true })
      .limit(200)

    if (error) throw new Error(error.message)

    return {
      success: true,
      source: 'fact_string',
      dateRange: { start: params.date_start, end: params.date_end },
      data: {
        records: data ?? [],
        recordCount: data?.length ?? 0,
        entity: { type: params.entity_type, id: params.entity_id },
      },
    }
  } catch (error) {
    return {
      success: false,
      source: 'executeRecentDetail',
      data: null,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// --- Helpers ---

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

interface SummaryRow {
  string_id: string
  inverter_id: string | null
  class: string
  energy_loss_wh: number | null
  underperf_ratio: number | null
  p_string_avg: number | null
  p_expected_avg: number | null
  date: string
}

async function queryDailySummary(
  supabase: ReturnType<typeof createSunalizeClient>,
  plantId: string,
  dateEnd: string,
  dateStart: string
): Promise<SummaryRow[]> {
  const { data } = await supabase
    .from('daily_string_summary')
    .select('string_id, inverter_id, class, energy_loss_wh, underperf_ratio, p_string_avg, p_expected_avg, date')
    .eq('plant_id', plantId)
    .gte('date', dateStart)
    .lte('date', dateEnd)
    .limit(5000)
  return (data ?? []) as SummaryRow[]
}

async function queryDailySummaryByEntity(
  supabase: ReturnType<typeof createSunalizeClient>,
  plantId: string,
  field: string,
  value: string,
  dateStart: string,
  dateEnd: string
): Promise<SummaryRow[]> {
  const { data } = await supabase
    .from('daily_string_summary')
    .select('string_id, inverter_id, class, energy_loss_wh, underperf_ratio, p_string_avg, p_expected_avg, date')
    .eq('plant_id', plantId)
    .eq(field, value)
    .gte('date', dateStart)
    .lte('date', dateEnd)
    .order('date', { ascending: true })
    .limit(2000)
  return (data ?? []) as SummaryRow[]
}

function aggregateSummary(rows: SummaryRow[]) {
  if (rows.length === 0) return { totalRecords: 0, message: 'Sin datos para este rango' }

  let totalLoss = 0
  let ratioSum = 0
  let ratioCount = 0
  const classes: Record<string, number> = { green: 0, blue: 0, orange: 0, red: 0, gray: 0 }
  const strings = new Set<string>()

  for (const r of rows) {
    totalLoss += Number(r.energy_loss_wh) || 0
    if (r.underperf_ratio !== null) {
      ratioSum += Number(r.underperf_ratio)
      ratioCount++
    }
    classes[r.class] = (classes[r.class] ?? 0) + 1
    strings.add(r.string_id)
  }

  return {
    totalRecords: rows.length,
    uniqueStrings: strings.size,
    totalLossWh: Math.round(totalLoss),
    totalLossKwh: Math.round(totalLoss / 10) / 100,
    avgRatio: ratioCount > 0 ? Math.round((ratioSum / ratioCount) * 1000) / 1000 : null,
    classDistribution: classes,
    dateRange: { start: rows[0].date, end: rows[rows.length - 1].date },
  }
}
