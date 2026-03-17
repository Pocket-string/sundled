/**
 * Fetch PR dashboard data for a plant and month.
 * Reads from daily_pr_summary and monthly_pr_summary tables.
 */

import { createSunalizeClient } from '@/lib/supabase/server'
import { GUARANTEED_PR, GUARANTEED_AVAILABILITY } from '../lib/constants'

export interface PrKpis {
  prCleanPct: number | null
  prModifiedPct: number | null
  availabilityPct: number | null
  availabilityModifiedPct: number | null
  totalProductionKwh: number | null
  totalIrradianceWhm2: number | null
  meterProductionKwh: number | null
  guaranteedPrPct: number
  guaranteedAvailabilityPct: number
}

export interface DailyPrPoint {
  date: string
  prCleanPct: number | null
  prModifiedPct: number | null
  availabilityPct: number | null
  productionKwh: number | null
  irradianceWhm2: number | null
}

export interface InverterPrRow {
  inverterId: string
  prCleanPct: number | null
  prModifiedPct: number | null
  availabilityPct: number | null
  availabilityModifiedPct: number | null
  totalProductionKwh: number | null
  peakPowerKwp: number | null
  totalLaecKwh: number
  totalLaeoKwh: number
}

export interface PrDashboardData {
  kpis: PrKpis
  dailyPoints: DailyPrPoint[]
  inverters: InverterPrRow[]
  hasData: boolean
  availableMonths: string[]
}

export async function getPrDashboard(
  plantId: string,
  month: string,
): Promise<PrDashboardData> {
  const supabase = createSunalizeClient()

  // Fetch monthly summary (plant-level row: inverter_id IS NULL)
  const { data: monthlySummary } = await supabase
    .from('monthly_pr_summary')
    .select('*')
    .eq('plant_id', plantId)
    .eq('month', month)
    .is('inverter_id', null)
    .single()

  // Fetch daily summaries (plant-level rows for chart)
  const { data: dailyPlant } = await supabase
    .from('daily_pr_summary')
    .select('date, daily_pr_pct, daily_pr_modified_pct, availability_pct, total_production_kwh, total_treated_irr_whm2')
    .eq('plant_id', plantId)
    .like('date', `${month}%`)
    .is('inverter_id', null)
    .order('date', { ascending: true })

  // Fetch monthly per-inverter summaries
  const { data: inverterSummaries } = await supabase
    .from('monthly_pr_summary')
    .select('inverter_id, pr_clean_pct, pr_clean_modified_pct, internal_availability_pct, availability_modified_pct, total_production_kwh, peak_power_kwp, total_laec_kwh, total_laeo_kwh')
    .eq('plant_id', plantId)
    .eq('month', month)
    .not('inverter_id', 'is', null)
    .order('inverter_id', { ascending: true })

  // Fetch available months
  const { data: monthRows } = await supabase
    .from('monthly_pr_summary')
    .select('month')
    .eq('plant_id', plantId)
    .is('inverter_id', null)
    .order('month', { ascending: false })

  const availableMonths = [...new Set((monthRows ?? []).map(r => r.month))]

  const hasData = !!monthlySummary

  const kpis: PrKpis = {
    prCleanPct: monthlySummary?.pr_clean_pct ?? null,
    prModifiedPct: monthlySummary?.pr_clean_modified_pct ?? null,
    availabilityPct: monthlySummary?.internal_availability_pct ?? null,
    availabilityModifiedPct: monthlySummary?.availability_modified_pct ?? null,
    totalProductionKwh: monthlySummary?.total_production_kwh ?? null,
    totalIrradianceWhm2: monthlySummary?.total_treated_irr_whm2 ?? null,
    meterProductionKwh: monthlySummary?.meter_production_kwh ?? null,
    guaranteedPrPct: GUARANTEED_PR,
    guaranteedAvailabilityPct: GUARANTEED_AVAILABILITY,
  }

  const dailyPoints: DailyPrPoint[] = (dailyPlant ?? []).map(d => ({
    date: d.date,
    prCleanPct: d.daily_pr_pct,
    prModifiedPct: d.daily_pr_modified_pct,
    availabilityPct: d.availability_pct,
    productionKwh: d.total_production_kwh,
    irradianceWhm2: d.total_treated_irr_whm2,
  }))

  const inverters: InverterPrRow[] = (inverterSummaries ?? []).map(inv => ({
    inverterId: inv.inverter_id,
    prCleanPct: inv.pr_clean_pct,
    prModifiedPct: inv.pr_clean_modified_pct,
    availabilityPct: inv.internal_availability_pct,
    availabilityModifiedPct: inv.availability_modified_pct,
    totalProductionKwh: inv.total_production_kwh,
    peakPowerKwp: inv.peak_power_kwp,
    totalLaecKwh: inv.total_laec_kwh ?? 0,
    totalLaeoKwh: inv.total_laeo_kwh ?? 0,
  }))

  return { kpis, dailyPoints, inverters, hasData, availableMonths }
}
