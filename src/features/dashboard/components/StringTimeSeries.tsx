'use client'

import { useState } from 'react'

interface DataPoint {
  ts: string
  i: number | null
  v: number | null
  p: number | null
  poa: number | null
}

interface Props {
  data: DataPoint[]
}

type Metric = 'p' | 'i' | 'v' | 'poa'

const METRIC_CONFIG: Record<Metric, { label: string; unit: string; color: string }> = {
  p: { label: 'Potencia', unit: 'W', color: '#10b981' },
  i: { label: 'Corriente', unit: 'A', color: '#3b82f6' },
  v: { label: 'Voltaje', unit: 'V', color: '#f59e0b' },
  poa: { label: 'POA', unit: 'W/m2', color: '#ef4444' },
}

/**
 * Simple SVG-based time series chart (no external library).
 * Shows one metric at a time with tab switching.
 */
export function StringTimeSeries({ data }: Props) {
  const [metric, setMetric] = useState<Metric>('p')

  const config = METRIC_CONFIG[metric]
  const values = data.map(d => d[metric])
  const validValues = values.filter((v): v is number => v !== null)

  if (validValues.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-gray-500 text-sm">
        Sin datos para graficar.
      </div>
    )
  }

  const minVal = Math.min(...validValues)
  const maxVal = Math.max(...validValues)
  const range = maxVal - minVal || 1

  const chartWidth = 800
  const chartHeight = 200
  const paddingX = 0
  const paddingY = 10

  // Build SVG path
  const points = values.map((v, i) => {
    if (v === null) return null
    const x = paddingX + (i / (values.length - 1)) * (chartWidth - 2 * paddingX)
    const y = paddingY + (1 - (v - minVal) / range) * (chartHeight - 2 * paddingY)
    return { x, y }
  })

  const pathSegments: string[] = []
  let inPath = false
  for (const pt of points) {
    if (pt === null) {
      inPath = false
      continue
    }
    if (!inPath) {
      pathSegments.push(`M${pt.x},${pt.y}`)
      inPath = true
    } else {
      pathSegments.push(`L${pt.x},${pt.y}`)
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
      {/* Metric Tabs */}
      <div className="flex gap-1">
        {(Object.keys(METRIC_CONFIG) as Metric[]).map(m => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              metric === m
                ? 'bg-gray-700 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {METRIC_CONFIG[m].label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>{config.label}</span>
        <span>·</span>
        <span>Min: {minVal.toFixed(1)} {config.unit}</span>
        <span>·</span>
        <span>Max: {maxVal.toFixed(1)} {config.unit}</span>
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-48">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const y = paddingY + (1 - frac) * (chartHeight - 2 * paddingY)
          return (
            <line
              key={frac}
              x1={0}
              y1={y}
              x2={chartWidth}
              y2={y}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
          )
        })}

        {/* Data line */}
        <path
          d={pathSegments.join(' ')}
          fill="none"
          stroke={config.color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
