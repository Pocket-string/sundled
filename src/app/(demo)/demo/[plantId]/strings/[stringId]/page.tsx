import { createSunalizeClient } from '@/lib/supabase/server'
import { getStringAnalyticsDemo } from '@/features/analytics/services/getStringAnalytics'
import { getAnalyticsSnapshotDemo } from '@/features/analytics/services/getAnalyticsSnapshot'
import { getStringLossStatsDemo, getStringDailySummariesDemo } from '@/features/analytics/services/getDailySummary'
import { getDailyClassificationForStringDemo } from '@/features/analytics/services/getDailyClassification'
import { StringChartsClient } from '@/features/analytics/components/StringChartsClient'
import { LossTracker } from '@/features/analytics/components/LossTracker'
import Link from 'next/link'

export const metadata = { title: 'Demo String Detail | Lucvia' }

interface Props {
  params: Promise<{ plantId: string; stringId: string }>
}

const STATUS_COLORS: Record<string, string> = {
  green: '#10b981',
  blue: '#22d3ee',
  orange: '#fb923c',
  red: '#ef4444',
  gray: '#4b5563',
}

export default async function DemoStringDetailPage({ params }: Props) {
  const { plantId, stringId } = await params
  const decodedStringId = decodeURIComponent(stringId)
  const supabase = createSunalizeClient()

  // Get tracker info
  const { data: tracker } = await supabase
    .from('dim_trackers')
    .select('*')
    .eq('plant_id', plantId)
    .eq('string_id', decodedStringId)
    .single()

  // Get current snapshot (uses module_group_p75 — correct peer reference)
  const dashboard = await getAnalyticsSnapshotDemo(plantId)
  const currentSnapshot = dashboard.snapshots.find((s) => s.string_id === decodedStringId)

  // Get analytics history (self-ref P75) + daily classification (module_group P75) + loss stats in parallel
  const [analyticsHistory, dailyClassification, lossStats, dailyHistory, timeSeriesResult] = await Promise.all([
    getStringAnalyticsDemo(plantId, decodedStringId, 14),
    getDailyClassificationForStringDemo(plantId, decodedStringId, 14),
    getStringLossStatsDemo(plantId, decodedStringId),
    getStringDailySummariesDemo(plantId, decodedStringId, 90),
    supabase
      .from('fact_string')
      .select('Fecha, i_string, v_string, p_string, poa, t_mod')
      .eq('plant_id', plantId)
      .eq('string_id', decodedStringId)
      .order('Fecha', { ascending: false })
      .limit(672),
  ])

  const rawData = (timeSeriesResult.data ?? []).reverse().map((row) => {
    const n = (v: unknown) => { const x = Number(v); return isNaN(x) ? null : x }
    return { ts: row.Fecha, i: n(row.i_string), v: n(row.v_string), p: n(row.p_string), poa: n(row.poa) }
  })

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <Link
          href={`/demo/${plantId}/dashboard`}
          className="text-gray-500 hover:text-gray-300 text-sm mb-2 inline-block"
        >
          &larr; Volver al dashboard
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">DEMO</span>
          <h1 className="text-2xl font-bold text-white">{decodedStringId}</h1>
        </div>
      </div>

      {/* Analytics Snapshot Card */}
      {currentSnapshot && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[currentSnapshot.class] }}
            />
            <h3 className="text-sm font-semibold text-white">Snapshot analitico</h3>
            <span className="text-xs text-gray-500 ml-auto">
              {currentSnapshot.ts_local}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="P string"
              value={currentSnapshot.p_string !== null ? `${currentSnapshot.p_string.toFixed(0)} W` : '—'}
            />
            <MetricCard
              label="P esperado"
              value={currentSnapshot.p_expected !== null ? `${currentSnapshot.p_expected.toFixed(0)} W` : '—'}
              sub={formatMethod(currentSnapshot.reference_method)}
            />
            <MetricCard
              label="Ratio"
              value={currentSnapshot.underperf_ratio !== null
                ? `${(currentSnapshot.underperf_ratio * 100).toFixed(1)}%`
                : '—'}
              color={
                currentSnapshot.class === 'green' ? 'text-emerald-400' :
                currentSnapshot.class === 'blue' ? 'text-cyan-400' :
                currentSnapshot.class === 'orange' ? 'text-orange-400' :
                currentSnapshot.class === 'red' ? 'text-red-400' : 'text-gray-500'
              }
            />
            <MetricCard
              label="Delta"
              value={currentSnapshot.underperf_delta_w !== null
                ? `${currentSnapshot.underperf_delta_w.toFixed(0)} W`
                : '—'}
              sub={`n=${currentSnapshot.reference_sample_size}`}
            />
          </div>
        </div>
      )}

      {/* Loss Tracker — historical losses and "since when" */}
      {dailyHistory.length > 0 && (
        <LossTracker stats={lossStats} history={dailyHistory} />
      )}

      {/* Tracker info */}
      {tracker && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <div><dt className="text-gray-500">CT</dt><dd className="text-gray-300">{tracker.ct_id}</dd></div>
            <div><dt className="text-gray-500">Inversor</dt><dd className="text-gray-300">{tracker.inverter_id}</dd></div>
            <div><dt className="text-gray-500">DC In</dt><dd className="text-gray-300">{tracker.dc_in}</dd></div>
            <div><dt className="text-gray-500">Modulo</dt><dd className="text-gray-300">{tracker.module ?? '—'}</dd></div>
            <div><dt className="text-gray-500">Tracker</dt><dd className="text-gray-300">{tracker.tracker_id}</dd></div>
            <div><dt className="text-gray-500">Peer Group</dt><dd className="text-gray-300">{tracker.peer_group ?? '—'}</dd></div>
            <div><dt className="text-gray-500">SVG ID</dt><dd className="text-gray-300">{tracker.svg_id}</dd></div>
            <div><dt className="text-gray-500">MPPT Key</dt><dd className="text-gray-300">{tracker.inverter_dc_key}</dd></div>
          </dl>
        </div>
      )}

      {/* Charts with shared temporal selector */}
      <StringChartsClient
        analyticsHistory={analyticsHistory}
        dailyClassification={dailyClassification}
        rawData={rawData}
      />
    </div>
  )
}

function MetricCard({ label, value, sub, color }: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600">{sub}</p>}
    </div>
  )
}

function formatMethod(method: string): string {
  switch (method) {
    case 'module_group_p75': return 'P75 grupo modulo'
    case 'same_string_p75': return 'P75 mismo string'
    case 'same_string_relaxed_p75': return 'P75 relajado'
    case 'peer_group_fallback': return 'Grupo par'
    case 'insufficient_data': return 'Sin referencia'
    default: return method
  }
}
