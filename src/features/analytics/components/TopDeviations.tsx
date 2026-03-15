import type { AnalyticsSnapshot } from '../types'
import Link from 'next/link'

interface Props {
  snapshots: AnalyticsSnapshot[]
  plantId: string
  basePath: string // '/demo/PLT_A' or '/plants/uuid'
}

const STATUS_COLORS: Record<string, string> = {
  green: 'bg-emerald-400',
  blue: 'bg-cyan-400',
  orange: 'bg-orange-400',
  red: 'bg-red-400',
  gray: 'bg-gray-600',
}

export function TopDeviations({ snapshots, plantId, basePath }: Props) {
  // Sort: red first, then orange, then blue (by delta_w desc)
  const classOrder: Record<string, number> = { red: 0, orange: 1, blue: 2, green: 3, gray: 4 }
  const top = snapshots
    .filter((s) => s.underperf_delta_w !== null && s.underperf_delta_w > 0)
    .sort((a, b) => {
      const classA = classOrder[a.class] ?? 3
      const classB = classOrder[b.class] ?? 3
      if (classA !== classB) return classA - classB
      return (b.underperf_delta_w ?? 0) - (a.underperf_delta_w ?? 0)
    })
    .slice(0, 10)

  if (top.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-gray-500 text-sm">
        Sin desviaciones detectadas.
      </div>
    )
  }

  const ratioColor = (cls: string) =>
    cls === 'green' ? 'text-emerald-400' :
    cls === 'blue' ? 'text-cyan-400' :
    cls === 'orange' ? 'text-orange-400' :
    cls === 'red' ? 'text-red-400' : 'text-gray-500'

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">Top 10 — Mayor desviacion (W)</h3>
      </div>

      {/* Mobile: card layout */}
      <div className="sm:hidden divide-y divide-gray-800/50">
        {top.map((s) => (
          <Link
            key={s.string_id}
            href={`${basePath}/strings/${encodeURIComponent(s.string_id)}`}
            className="block px-4 py-3 hover:bg-gray-800/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_COLORS[s.class]}`} />
                <span className="text-white text-sm font-medium">{s.string_id}</span>
              </div>
              <span className={`text-sm font-semibold ${ratioColor(s.class)}`}>
                {s.underperf_ratio !== null ? `${(s.underperf_ratio * 100).toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-500">P</span>
                <span className="text-gray-300 tabular-nums ml-1">{s.p_string?.toFixed(0) ?? '—'}W</span>
              </div>
              <div>
                <span className="text-gray-500">Esp.</span>
                <span className="text-gray-300 tabular-nums ml-1">{s.p_expected?.toFixed(0) ?? '—'}W</span>
              </div>
              <div>
                <span className="text-gray-500">Delta</span>
                <span className="text-red-400 font-medium tabular-nums ml-1">{s.underperf_delta_w?.toFixed(0) ?? '—'}W</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-gray-500">{s.inverter_id ?? '—'}</span>
              <span className="text-gray-600">{formatMethod(s.reference_method)}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">String</th>
              <th className="px-3 py-2 font-medium">Inversor</th>
              <th className="px-3 py-2 font-medium text-right">P (W)</th>
              <th className="px-3 py-2 font-medium text-right">P esperado</th>
              <th className="px-3 py-2 font-medium text-right">Delta (W)</th>
              <th className="px-3 py-2 font-medium text-right">Ratio</th>
              <th className="px-3 py-2 font-medium">Metodo</th>
            </tr>
          </thead>
          <tbody>
            {top.map((s) => (
              <tr key={s.string_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-3 py-2">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_COLORS[s.class]}`} />
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`${basePath}/strings/${encodeURIComponent(s.string_id)}`}
                    className="text-white hover:text-emerald-400 transition-colors"
                  >
                    {s.string_id}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-400">{s.inverter_id ?? '—'}</td>
                <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{s.p_string?.toFixed(0) ?? '—'}</td>
                <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{s.p_expected?.toFixed(0) ?? '—'}</td>
                <td className="px-3 py-2 text-right text-red-400 font-medium tabular-nums">
                  {s.underperf_delta_w?.toFixed(0) ?? '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={ratioColor(s.class)}>
                    {s.underperf_ratio !== null ? `${(s.underperf_ratio * 100).toFixed(1)}%` : '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">{formatMethod(s.reference_method)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
