import { getAnalyticsSnapshotDemo } from '@/features/analytics/services/getAnalyticsSnapshot'
import {
  getAvailableDatesDemo,
  getAvailableTimestampsDemo,
} from '@/features/analytics/services/getAvailableDates'
import { TemporalSelector } from '@/features/analytics/components/TemporalSelector'
import Link from 'next/link'

export const metadata = { title: 'Inversor Detail | Lucvia' }

interface Props {
  params: Promise<{ plantId: string; inverterId: string }>
  searchParams: Promise<{ date?: string }>
}

const STATUS_COLORS: Record<string, string> = {
  green: 'bg-emerald-400',
  blue: 'bg-cyan-400',
  orange: 'bg-orange-400',
  red: 'bg-red-400',
  gray: 'bg-gray-600',
}

export default async function InverterDetailPage({ params, searchParams }: Props) {
  const { plantId, inverterId: rawInverterId } = await params
  const { date: reqDate } = await searchParams
  const inverterId = decodeURIComponent(rawInverterId)

  const dates = await getAvailableDatesDemo(plantId)
  const currentDate = reqDate ?? dates[0] ?? null

  const timestamps = currentDate
    ? await getAvailableTimestampsDemo(plantId, currentDate)
    : []

  const dashboard = await getAnalyticsSnapshotDemo(plantId, currentDate ?? undefined)

  // Filter snapshots for this inverter
  const inverterSnapshots = dashboard.snapshots
    .filter((s) => s.inverter_id === inverterId)
    .sort((a, b) => (a.underperf_ratio ?? 999) - (b.underperf_ratio ?? 999))

  // Summary counts
  let green = 0, blue = 0, orange = 0, red = 0, gray = 0
  for (const s of inverterSnapshots) {
    if (s.class === 'green') green++
    else if (s.class === 'blue') blue++
    else if (s.class === 'orange') orange++
    else if (s.class === 'red') red++
    else gray++
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">DEMO</span>
            <h1 className="text-2xl font-bold text-white">{inverterId}</h1>
          </div>
          <p className="text-gray-400 text-sm">
            {inverterSnapshots.length} strings ·{' '}
            {dashboard.analysisMode === 'daily_window' && dashboard.windowIntervals
              ? `Ventana: ${dashboard.windowStart} — ${dashboard.windowEnd} (${dashboard.windowIntervals} intervalos)`
              : dashboard.timestamp ?? ''}
          </p>
        </div>
        <Link
          href={`/demo/${plantId}/dashboard${reqDate ? `?date=${reqDate}` : ''}`}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
        >
          Volver al Dashboard
        </Link>
      </div>

      {/* Date selector (no timestamp needed for daily window) */}
      <TemporalSelector
        dates={dates}
        timestamps={timestamps}
        currentDate={currentDate}
        currentTs={dashboard.timestamp}
        basePath={`/demo/${plantId}/inverter/${encodeURIComponent(inverterId)}`}
        hiddenTimestamp
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-1">Total</p>
          <p className="text-2xl font-bold text-white">{inverterSnapshots.length}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-1">Optimo</p>
          <p className="text-2xl font-bold text-emerald-400">{green}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-1">Media-alta</p>
          <p className="text-2xl font-bold text-cyan-400">{blue}</p>
        </div>
        <div className={`rounded-xl border bg-gray-900 p-4 ${orange > 0 ? 'border-orange-500/50' : 'border-gray-800'}`}>
          <p className="text-xs text-gray-500 mb-1">Media-baja</p>
          <p className="text-2xl font-bold text-orange-400">{orange}</p>
        </div>
        <div className={`rounded-xl border bg-gray-900 p-4 ${red > 0 ? 'border-red-500/50' : 'border-gray-800'}`}>
          <p className="text-xs text-gray-500 mb-1">Bajo</p>
          <p className="text-2xl font-bold text-red-400">{red}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 mb-1">Sin dato</p>
          <p className="text-2xl font-bold text-gray-500">{gray}</p>
        </div>
      </div>

      {/* Strings table */}
      {inverterSnapshots.length > 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">
              Strings de {inverterId} ({inverterSnapshots.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">String ID</th>
                  <th className="px-4 py-3 font-medium text-right">P prom (W)</th>
                  <th className="px-4 py-3 font-medium text-right">P esperado</th>
                  <th className="px-4 py-3 font-medium text-right">Delta (W)</th>
                  <th className="px-4 py-3 font-medium text-right">POA prom</th>
                  <th className="px-4 py-3 font-medium text-right">Ratio</th>
                  <th className="px-4 py-3 font-medium">Metodo</th>
                </tr>
              </thead>
              <tbody>
                {inverterSnapshots.map((s) => (
                  <tr key={s.string_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2.5">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_COLORS[s.class]}`} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/demo/${plantId}/strings/${encodeURIComponent(s.string_id)}`}
                        className="text-white hover:text-emerald-400 transition-colors"
                      >
                        {s.string_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{s.p_string?.toFixed(0) ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{s.p_expected?.toFixed(0) ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-red-400 font-medium">
                      {s.underperf_delta_w !== null && s.underperf_delta_w > 0
                        ? s.underperf_delta_w.toFixed(0)
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{s.poa?.toFixed(0) ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={
                        s.class === 'green' ? 'text-emerald-400' :
                        s.class === 'blue' ? 'text-cyan-400' :
                        s.class === 'orange' ? 'text-orange-400' :
                        s.class === 'red' ? 'text-red-400' : 'text-gray-500'
                      }>
                        {s.underperf_ratio !== null ? `${(s.underperf_ratio * 100).toFixed(1)}%` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{formatMethod(s.reference_method)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center text-gray-400">
          Sin datos para este inversor en la fecha seleccionada.
        </div>
      )}
    </div>
  )
}

function formatMethod(method: string): string {
  switch (method) {
    case 'module_group_p75': return 'P75 modulo'
    case 'same_string_p75': return 'P75 mismo'
    case 'same_string_relaxed_p75': return 'P75 relajado'
    case 'peer_group_fallback': return 'Grupo par'
    case 'insufficient_data': return 'Sin ref.'
    default: return method
  }
}
