import { Suspense } from 'react'
import { getAnalyticsSnapshotDemo } from '@/features/analytics/services/getAnalyticsSnapshot'
import {
  getAvailableDatesDemo,
  getAvailableTimestampsDemo,
} from '@/features/analytics/services/getAvailableDates'
import { getIntradayPowerDemo } from '@/features/analytics/services/getIntradayPower'
import { TemporalSelector } from '@/features/analytics/components/TemporalSelector'
import { PerformanceDonut } from '@/features/analytics/components/PerformanceDonut'
import { IntradayPowerChart } from '@/features/analytics/components/IntradayPowerChart'
import { TopDeviations } from '@/features/analytics/components/TopDeviations'
import { InverterSummary } from '@/features/analytics/components/InverterSummary'
import { BentoGrid } from '@/components/ui/BentoGrid'
import { BentoCard } from '@/components/ui/BentoCard'
import Link from 'next/link'

export const metadata = { title: 'Demo Dashboard | Lucvia' }

interface Props {
  params: Promise<{ plantId: string }>
  searchParams: Promise<{ date?: string; ts?: string }>
}

export default async function DemoDashboardPage({ params, searchParams }: Props) {
  const { plantId } = await params
  const { date: reqDate, ts: reqTs } = await searchParams

  const dates = await getAvailableDatesDemo(plantId)
  const currentDate = reqDate ?? dates[0] ?? null

  const timestamps = currentDate
    ? await getAvailableTimestampsDemo(plantId, currentDate)
    : []

  // Fetch snapshot + intraday power in parallel
  const [dashboard, intradayPower] = await Promise.all([
    getAnalyticsSnapshotDemo(plantId, currentDate ?? undefined, reqTs),
    currentDate ? getIntradayPowerDemo(plantId, currentDate) : Promise.resolve([]),
  ])

  // Analysis context line
  const analysisInfo = dashboard.analysisMode === 'peak_energy' && dashboard.peakPoaThreshold
    ? `${dashboard.windowIntervals} intervalos · POA ≥ ${dashboard.peakPoaThreshold} W/m² · ${dashboard.windowStart} — ${dashboard.windowEnd} · Ref: P75 por grupo de modulo`
    : dashboard.analysisMode === 'daily_window' && dashboard.windowStart
      ? `Ventana: ${dashboard.windowStart} — ${dashboard.windowEnd} (${dashboard.windowIntervals} intervalos)`
      : null

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">DEMO</span>
            <h1 className="text-2xl font-bold text-white">ZALDIVIA — Dashboard Analitico</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <Suspense fallback={<span>Cargando...</span>}>
              <TemporalSelector
                dates={dates}
                timestamps={timestamps}
                currentDate={currentDate}
                currentTs={dashboard.timestamp}
                basePath={`/demo/${plantId}/dashboard`}
                hiddenTimestamp
              />
            </Suspense>
            {analysisInfo && (
              <span className="text-xs text-gray-500 hidden md:inline">
                {analysisInfo}
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/demo/${plantId}/heatmap${reqDate ? `?date=${reqDate}` : ''}${reqTs ? `&ts=${reqTs}` : ''}`}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors flex-shrink-0"
        >
          Heatmap
        </Link>
      </div>

      {/* Row 1: Donut + Top Deviations */}
      <BentoGrid cols={3}>
        <BentoCard span="default" padding="sm">
          <PerformanceDonut
            greenCount={dashboard.greenCount}
            blueCount={dashboard.blueCount}
            orangeCount={dashboard.orangeCount}
            redCount={dashboard.redCount}
            grayCount={dashboard.grayCount}
            totalStrings={dashboard.totalStrings}
          />
        </BentoCard>
        <BentoCard span="wide" padding="sm">
          <TopDeviations
            snapshots={dashboard.snapshots}
            plantId={plantId}
            basePath={`/demo/${plantId}`}
          />
        </BentoCard>
      </BentoGrid>

      {/* Intraday Power Chart */}
      <BentoCard span="wide" padding="md" className="w-full">
        <IntradayPowerChart
          points={intradayPower}
          currentTs={dashboard.timestamp}
        />
      </BentoCard>

      {/* Inverter Summary */}
      <BentoCard span="wide" padding="md" className="w-full">
        <InverterSummary
          snapshots={dashboard.snapshots}
          basePath={`/demo/${plantId}`}
          currentDate={currentDate}
        />
      </BentoCard>
    </div>
  )
}
