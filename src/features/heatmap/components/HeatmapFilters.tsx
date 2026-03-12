'use client'

import { useHeatmapStore, type HeatmapMetric } from '../store/useHeatmapStore'
import type { AnalyticsSnapshot } from '@/features/analytics/types'

interface Props {
  snapshots: AnalyticsSnapshot[]
}

const METRICS: { value: HeatmapMetric; label: string }[] = [
  { value: 'class', label: 'Clasificacion' },
  { value: 'underperf_ratio', label: 'Ratio' },
  { value: 'p_string', label: 'P string' },
  { value: 'p_expected', label: 'P esperado' },
]

const SEVERITIES = [
  { value: null, label: 'Todos' },
  { value: 'green', label: 'Optimo', color: 'bg-emerald-400' },
  { value: 'blue', label: 'Media-alta', color: 'bg-cyan-400' },
  { value: 'orange', label: 'Media-baja', color: 'bg-orange-400' },
  { value: 'red', label: 'Bajo', color: 'bg-red-400' },
  { value: 'gray', label: 'Sin dato', color: 'bg-gray-600' },
]

export function HeatmapFilters({ snapshots }: Props) {
  const { metric, filters, setMetric, setFilter, clearFilters } = useHeatmapStore()

  // Derive unique CTs and inverters from data
  const cts = [...new Set(snapshots.map((s) => s.svg_id?.match(/^(CT\d+)/)?.[1]).filter(Boolean))] as string[]

  // Filter inverters to only those belonging to the selected CT
  const relevantSnapshots = filters.ct
    ? snapshots.filter((s) => s.svg_id?.startsWith(filters.ct!))
    : snapshots
  const inverters = [...new Set(relevantSnapshots.map((s) => s.inverter_id).filter(Boolean))] as string[]

  // Clear inverter selection if it no longer belongs to the selected CT
  const handleCtChange = (ct: string | null) => {
    setFilter('ct', ct)
    if (filters.inverter && ct) {
      const ctInverters = snapshots
        .filter((s) => s.svg_id?.startsWith(ct))
        .map((s) => s.inverter_id)
      if (!ctInverters.includes(filters.inverter)) {
        setFilter('inverter', null)
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {/* Metric selector */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500">Metrica</label>
        <div className="flex gap-1">
          {METRICS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMetric(m.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                metric === m.value
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-4 w-px bg-gray-700" />

      {/* CT filter */}
      <select
        value={filters.ct ?? ''}
        onChange={(e) => handleCtChange(e.target.value || null)}
        className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1"
      >
        <option value="">Todos CT</option>
        {cts.sort().map((ct) => (
          <option key={ct} value={ct}>{ct}</option>
        ))}
      </select>

      {/* Inverter filter */}
      <select
        value={filters.inverter ?? ''}
        onChange={(e) => setFilter('inverter', e.target.value || null)}
        className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1"
      >
        <option value="">Todos inversores</option>
        {inverters.sort().map((inv) => (
          <option key={inv} value={inv}>{inv}</option>
        ))}
      </select>

      {/* Severity filter */}
      <div className="flex gap-1">
        {SEVERITIES.map((sev) => (
          <button
            key={sev.value ?? 'all'}
            onClick={() => setFilter('severity', sev.value)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
              filters.severity === sev.value
                ? 'bg-gray-700 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {sev.color && <span className={`w-2 h-2 rounded-full ${sev.color}`} />}
            {sev.label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-gray-700" />

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar string..."
        value={filters.search}
        onChange={(e) => setFilter('search', e.target.value)}
        className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2.5 py-1 w-36 placeholder-gray-600"
      />

      {/* Clear */}
      {(filters.ct || filters.inverter || filters.severity || filters.search) && (
        <button
          onClick={clearFilters}
          className="text-xs text-gray-500 hover:text-white transition-colors"
        >
          Limpiar
        </button>
      )}
    </div>
  )
}
