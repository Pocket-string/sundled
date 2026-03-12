import { Suspense } from 'react'
import { createSunalizeClient } from '@/lib/supabase/server'
import { getAnalyticsSnapshotDemo } from '@/features/analytics/services/getAnalyticsSnapshot'
import {
  getAvailableDatesDemo,
  getAvailableTimestampsDemo,
} from '@/features/analytics/services/getAvailableDates'
import { TemporalSelector } from '@/features/analytics/components/TemporalSelector'
import { SvgHeatmap } from '@/features/heatmap/components/SvgHeatmap'
import { HeatmapFilters } from '@/features/heatmap/components/HeatmapFilters'
import { HeatmapGrid } from '@/features/heatmap/components/HeatmapGrid'
import Link from 'next/link'

export const metadata = { title: 'Demo Heatmap | Lucvia' }

interface Props {
  params: Promise<{ plantId: string }>
  searchParams: Promise<{ date?: string; ts?: string }>
}

export default async function DemoHeatmapPage({ params, searchParams }: Props) {
  const { plantId } = await params
  const { date: reqDate, ts: reqTs } = await searchParams
  const supabase = createSunalizeClient()

  // Get SVG layout — only rect elements with valid coordinates
  const { data: rawLayout } = await supabase
    .from('svg_layout')
    .select('svg_id, x, y, width, height')
    .eq('plant_id', plantId)
    .not('x', 'is', null)
    .not('y', 'is', null)

  // Fix: CT2_INV2-1_TRK2_S3 and S4 have wrong coordinates in svg_layout DB
  // Correct positions: S3 → (50, 439), S4 → (50, 238)
  const COORD_FIXES: Record<string, { x: number; y: number }> = {
    'CT2_INV2-1_TRK2_S3': { x: 50, y: 237 },
    'CT2_INV2-1_TRK2_S4': { x: 50, y: 437 },
  }

  const layout = (rawLayout ?? [])
    .filter((l) => l.x !== null && l.y !== null)
    .map((l) => {
      const fix = COORD_FIXES[l.svg_id as string]
      return {
        svg_id: l.svg_id as string,
        x: fix ? fix.x : (Number(l.x) || 0),
        y: fix ? fix.y : (Number(l.y) || 0),
        width: Number(l.width) || 9,
        height: Number(l.height) || 29,
      }
    })

  // Resolve temporal selection
  const dates = await getAvailableDatesDemo(plantId)
  const currentDate = reqDate ?? dates[0] ?? null
  const timestamps = currentDate
    ? await getAvailableTimestampsDemo(plantId, currentDate)
    : []

  const dashboard = await getAnalyticsSnapshotDemo(plantId, currentDate ?? undefined, reqTs)

  return (
    <div className="p-6 md:p-8 max-w-full mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">DEMO</span>
            <h1 className="text-2xl font-bold text-white">ZALDIVIA — Heatmap Analitico</h1>
          </div>
          <p className="text-gray-400 text-sm">
            {dashboard.analysisMode === 'peak_energy' && dashboard.windowStart
              ? `Peak POA: ${dashboard.windowStart} — ${dashboard.windowEnd} (${dashboard.windowIntervals} intervalos, ≥${dashboard.peakPoaThreshold ?? '?'} W/m²) · ${dashboard.totalStrings} strings`
              : dashboard.timestamp
                ? `Snapshot: ${dashboard.timestamp} · ${layout.length} strings`
                : 'Sin datos disponibles'}
          </p>
        </div>
        <Link
          href={`/demo/${plantId}/dashboard${reqDate ? `?date=${reqDate}` : ''}${reqTs ? `&ts=${reqTs}` : ''}`}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
        >
          Dashboard
        </Link>
      </div>

      {/* Temporal Selector (timestamp hidden — peak_energy mode auto-selects peak intervals) */}
      <Suspense fallback={<div className="h-10" />}>
        <TemporalSelector
          dates={dates}
          timestamps={timestamps}
          currentDate={currentDate}
          currentTs={dashboard.timestamp}
          basePath={`/demo/${plantId}/heatmap`}
          hiddenTimestamp
        />
      </Suspense>

      {/* Filters */}
      <HeatmapFilters snapshots={dashboard.snapshots} />

      {/* Heatmap + Grid */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <SvgHeatmap
            layout={layout}
            snapshots={dashboard.snapshots}
            plantId={plantId}
          />
        </div>
        <div className="w-80 flex-shrink-0">
          <HeatmapGrid
            snapshots={dashboard.snapshots}
            basePath={`/demo/${plantId}`}
          />
        </div>
      </div>
    </div>
  )
}
