'use client'

import type { AnalyticsSnapshot } from '../types'

interface Props {
  snapshots: AnalyticsSnapshot[]
}

/**
 * Single-line SVG chart for underperf_ratio with threshold bands
 * at 0.95 (green) and 0.80 (yellow → red).
 */
export function RatioTimeSeries({ snapshots }: Props) {
  const data = snapshots.filter((s) => s.underperf_ratio !== null)

  if (data.length < 2) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-gray-500 text-sm">
        Datos insuficientes para graficar ratio temporal.
      </div>
    )
  }

  const ratios = data.map((s) => s.underperf_ratio!)

  // Fixed Y range: 0.5 to 1.2 (or adjust to data)
  const minVal = Math.min(0.5, Math.min(...ratios) - 0.05)
  const maxVal = Math.max(1.2, Math.max(...ratios) + 0.05)
  const range = maxVal - minVal

  const chartWidth = 800
  const chartHeight = 180
  const paddingY = 10

  const toX = (i: number) => (i / (data.length - 1)) * chartWidth
  const toY = (v: number) => paddingY + (1 - (v - minVal) / range) * (chartHeight - 2 * paddingY)

  // Threshold lines
  const y95 = toY(0.95)
  const y80 = toY(0.80)

  // Build ratio path with color segments
  const segments: string[] = []
  let inPath = false
  for (let i = 0; i < data.length; i++) {
    const v = data[i].underperf_ratio!
    const x = toX(i)
    const y = toY(v)
    if (!inPath) {
      segments.push(`M${x},${y}`)
      inPath = true
    } else {
      segments.push(`L${x},${y}`)
    }
  }
  const pathD = segments.join(' ')

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-2">
      <div className="flex items-center gap-4 text-xs">
        <span className="text-gray-400">Ratio de rendimiento (underperf_ratio)</span>
        <span className="text-gray-500 ml-auto">
          Min: {Math.min(...ratios).toFixed(2)} · Max: {Math.max(...ratios).toFixed(2)}
        </span>
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-44">
        {/* Threshold bands */}
        <rect x={0} y={paddingY} width={chartWidth} height={y95 - paddingY} fill="rgba(16,185,129,0.06)" />
        <rect x={0} y={y95} width={chartWidth} height={y80 - y95} fill="rgba(245,158,11,0.06)" />
        <rect x={0} y={y80} width={chartWidth} height={chartHeight - paddingY - y80} fill="rgba(239,68,68,0.06)" />

        {/* Threshold lines */}
        <line x1={0} y1={y95} x2={chartWidth} y2={y95} stroke="#10b981" strokeWidth={1} strokeDasharray="4,4" opacity={0.5} />
        <line x1={0} y1={y80} x2={chartWidth} y2={y80} stroke="#ef4444" strokeWidth={1} strokeDasharray="4,4" opacity={0.5} />

        {/* Labels */}
        <text x={chartWidth - 4} y={y95 - 4} textAnchor="end" fill="#10b981" fontSize="10" opacity={0.7}>95%</text>
        <text x={chartWidth - 4} y={y80 - 4} textAnchor="end" fill="#ef4444" fontSize="10" opacity={0.7}>80%</text>

        {/* Ratio line */}
        <path d={pathD} fill="none" stroke="#60a5fa" strokeWidth={1.5} strokeLinejoin="round" />

        {/* Dots */}
        {data.map((s, i) => {
          const v = s.underperf_ratio!
          const color = v >= 0.95 ? '#10b981' : v >= 0.80 ? '#f59e0b' : '#ef4444'
          return (
            <circle key={i} cx={toX(i)} cy={toY(v)} r={2} fill={color}>
              <title>{`${s.ts_local.substring(0, 16)} — ${(v * 100).toFixed(1)}%`}</title>
            </circle>
          )
        })}
      </svg>
    </div>
  )
}
