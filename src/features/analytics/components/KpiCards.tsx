import type { SnapshotResult } from '../services/getAnalyticsSnapshot'

interface Props {
  data: SnapshotResult
}

export function KpiCards({ data }: Props) {
  const isPeakEnergy = data.analysisMode === 'peak_energy'
  const intervals = data.windowIntervals ?? 0
  const poaThreshold = data.peakPoaThreshold ?? 0

  const analysisLabel = isPeakEnergy && poaThreshold
    ? `Analisis sobre ${intervals} intervalos de mayor irradiancia (POA ≥ ${poaThreshold} W/m²) · Referencia: P75 por grupo de modulo`
    : data.analysisMode === 'daily_window'
      ? `Ventana diaria · ${intervals} intervalos · Ref: P75 por grupo de modulo`
      : null

  // POA KPI: in peak_energy mode, show both threshold and avg
  const poaLabel = isPeakEnergy ? 'POA peak' : 'POA promedio'
  const poaSub = isPeakEnergy && poaThreshold
    ? `Umbral ≥ ${poaThreshold} W/m²`
    : undefined

  return (
    <div className="space-y-2">
      {analysisLabel && (
        <p className="text-xs text-gray-500">
          {analysisLabel}
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total strings" value={data.totalStrings.toString()} />
        <KpiCard label="Optimo" value={data.greenCount.toString()} color="text-emerald-400" />
        <KpiCard label="Media-alta" value={data.blueCount.toString()} color="text-cyan-400" />
        <KpiCard label="Media-baja" value={data.orangeCount.toString()} color="text-orange-400" alert={data.orangeCount > 0} />
        <KpiCard label="Bajo" value={data.redCount.toString()} color="text-red-400" alert={data.redCount > 0} />
        <KpiCard label="Sin dato" value={data.grayCount.toString()} color="text-gray-500" />
        <KpiCard
          label={poaLabel}
          value={data.avgPoa !== null ? `${data.avgPoa} W/m²` : '—'}
          sub={poaSub}
        />
        {isPeakEnergy && (
          <KpiCard
            label="Intervalos"
            value={intervals.toString()}
            sub={data.windowStart && data.windowEnd ? `${data.windowStart} — ${data.windowEnd}` : undefined}
          />
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, color, alert, sub }: {
  label: string
  value: string
  color?: string
  alert?: boolean
  sub?: string
}) {
  return (
    <div className={`rounded-xl border bg-gray-900 p-4 ${alert ? 'border-red-500/50' : 'border-gray-800'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}
