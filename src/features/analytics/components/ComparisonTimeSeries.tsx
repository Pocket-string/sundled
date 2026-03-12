'use client'

import type { AnalyticsSnapshot } from '../types'

interface Props {
  snapshots: AnalyticsSnapshot[]
}

/**
 * Dual-line SVG chart: p_string (emerald) vs p_expected (dashed cyan).
 * Shows area fill between lines to highlight deviation.
 */
export function ComparisonTimeSeries({ snapshots }: Props) {
  const data = snapshots.filter((s) => s.p_string !== null)

  if (data.length < 2) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-gray-500 text-sm">
        Datos insuficientes para comparar p_string vs p_expected.
      </div>
    )
  }

  const pValues = data.map((s) => s.p_string!).filter((v) => !isNaN(v))
  const peValues = data
    .map((s) => s.p_expected)
    .filter((v): v is number => v !== null && !isNaN(v))

  const allValues = [...pValues, ...peValues]
  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)
  const range = maxVal - minVal || 1

  const chartWidth = 800
  const chartHeight = 200
  const paddingY = 10

  const toX = (i: number) => (i / (data.length - 1)) * chartWidth
  const toY = (v: number) => paddingY + (1 - (v - minVal) / range) * (chartHeight - 2 * paddingY)

  // Build p_string path
  const pPath = buildPath(data, (s) => s.p_string, toX, toY)
  // Build p_expected path
  const pePath = buildPath(data, (s) => s.p_expected, toX, toY)

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-2">
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
          <span className="text-gray-400">P string</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-cyan-400 inline-block border-dashed" style={{ borderTop: '2px dashed #22d3ee', height: 0 }} />
          <span className="text-gray-400">P esperado</span>
        </span>
        <span className="text-gray-500 ml-auto">
          Min: {minVal.toFixed(0)} W · Max: {maxVal.toFixed(0)} W
        </span>
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-48">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = paddingY + (1 - frac) * (chartHeight - 2 * paddingY)
          return (
            <line key={frac} x1={0} y1={y} x2={chartWidth} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          )
        })}

        {/* p_expected line (dashed) */}
        {pePath && (
          <path d={pePath} fill="none" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="6,3" strokeLinejoin="round" />
        )}

        {/* p_string line */}
        {pPath && (
          <path d={pPath} fill="none" stroke="#10b981" strokeWidth={1.5} strokeLinejoin="round" />
        )}
      </svg>
    </div>
  )
}

function buildPath(
  data: AnalyticsSnapshot[],
  getValue: (s: AnalyticsSnapshot) => number | null,
  toX: (i: number) => number,
  toY: (v: number) => number
): string | null {
  const segments: string[] = []
  let inPath = false

  for (let i = 0; i < data.length; i++) {
    const v = getValue(data[i])
    if (v === null || isNaN(v)) {
      inPath = false
      continue
    }
    const x = toX(i)
    const y = toY(v)
    if (!inPath) {
      segments.push(`M${x},${y}`)
      inPath = true
    } else {
      segments.push(`L${x},${y}`)
    }
  }

  return segments.length > 0 ? segments.join(' ') : null
}
