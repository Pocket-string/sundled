import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getPlantDashboard } from '@/features/dashboard/services/getPlantDashboard'
import { SvgHeatmap } from '@/features/heatmap/components/SvgHeatmap'
import { HeatmapFilters } from '@/features/heatmap/components/HeatmapFilters'
import { HeatmapGrid } from '@/features/heatmap/components/HeatmapGrid'
import type { AnalyticsSnapshot } from '@/features/analytics/types'

export const metadata = { title: 'Heatmap | Lucvia' }

interface Props {
  params: Promise<{ plantId: string }>
}

export default async function HeatmapPage({ params }: Props) {
  const { plantId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: plant } = await supabase
    .from('plants')
    .select('id, name')
    .eq('id', plantId)
    .single()

  if (!plant) notFound()

  // Get SVG layout — only rect elements with valid coordinates
  const { data: layout } = await supabase
    .from('svg_layout')
    .select('svg_id, x, y, width, height')
    .eq('plant_id', plantId)
    .not('x', 'is', null)
    .not('y', 'is', null)

  // Get latest readings and convert to snapshot format
  const dashboard = await getPlantDashboard(plantId)
  const snapshots: AnalyticsSnapshot[] = dashboard.readings.map((r) => ({
    plant_id: plantId,
    ts_utc: dashboard.lastTimestamp ?? '',
    ts_local: dashboard.lastTimestamp ?? '',
    string_id: r.string_id,
    svg_id: r.svg_id,
    inverter_id: r.inverter_id,
    tracker_id: null,
    dc_in: null,
    peer_group: r.peer_group,
    poa: r.poa,
    t_mod: r.t_mod,
    i_string: r.i_string,
    v_string: r.v_string,
    p_string: r.p_string,
    p_expected: null,
    underperf_ratio: r.underperf_ratio,
    underperf_delta_w: null,
    class: r.status,
    reference_method: 'insufficient_data',
    reference_sample_size: 0,
  }))

  return (
    <div className="p-6 md:p-8 max-w-full mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">{plant.name} — Heatmap</h1>
        <p className="text-gray-400 text-sm mt-1">
          {dashboard.lastTimestamp
            ? `Ultimo dato: ${dashboard.lastTimestamp}`
            : 'Sin datos disponibles'}
        </p>
      </div>

      <HeatmapFilters snapshots={snapshots} />

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <SvgHeatmap
            layout={(layout ?? []).map((l) => {
              // Fix: CT2_INV2-1_TRK2_S3/S4 have wrong coordinates in svg_layout DB
              const coordFixes: Record<string, { x: number; y: number }> = {
                'CT2_INV2-1_TRK2_S3': { x: 50, y: 237 },
                'CT2_INV2-1_TRK2_S4': { x: 50, y: 437 },
              }
              const fix = coordFixes[l.svg_id]
              return {
                svg_id: l.svg_id,
                x: fix?.x ?? l.x,
                y: fix?.y ?? l.y,
                width: l.width,
                height: l.height,
              }
            })}
            snapshots={snapshots}
            plantId={plantId}
          />
        </div>
        <div className="w-80 flex-shrink-0">
          <HeatmapGrid
            snapshots={snapshots}
            basePath={`/plants/${plantId}`}
          />
        </div>
      </div>
    </div>
  )
}
