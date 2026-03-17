'use client'

import type { DailyPrPoint } from '../services/getPrDashboard'

interface Props {
  points: DailyPrPoint[]
  guaranteedPrPct: number
}

/**
 * SVG line chart: daily PR clean + PR modified with guarantee threshold line.
 * Values are stored as fractions (0-1), displayed as percentages.
 */
export function DailyPrChart({ points, guaranteedPrPct }: Props) {
  const validPoints = points.filter(p => p.prCleanPct !== null)

  if (validPoints.length < 2) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-gray-500 text-sm">
        Datos insuficientes para graficar PR diario.
      </div>
    )
  }

  const prValues = validPoints.map(p => p.prCleanPct! * 100)
  const prModValues = validPoints
    .map(p => p.prModifiedPct !== null ? p.prModifiedPct * 100 : null)

  const guarantee = guaranteedPrPct * 100

  // Y range: dynamic based on data, but always show guarantee line
  const allValues = [...prValues, ...prModValues.filter((v): v is number => v !== null), guarantee]
  const minY = Math.min(Math.min(...allValues) - 3, 60)
  const maxY = Math.max(Math.max(...allValues) + 3, 100)
  const rangeY = maxY - minY

  const W = 800
  const H = 200
  const padY = 12
  const padX = 40

  const toX = (i: number) => padX + (i / (validPoints.length - 1)) * (W - padX - 10)
  const toY = (v: number) => padY + (1 - (v - minY) / rangeY) * (H - 2 * padY)

  // Build paths
  const cleanPath = validPoints
    .map((_, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(prValues[i])}`)
    .join(' ')

  const modSegments: string[] = []
  let modStarted = false
  for (let i = 0; i < validPoints.length; i++) {
    const v = prModValues[i]
    if (v !== null) {
      modSegments.push(`${!modStarted ? 'M' : 'L'}${toX(i)},${toY(v)}`)
      modStarted = true
    } else {
      modStarted = false
    }
  }
  const modPath = modSegments.join(' ')

  // Y-axis grid lines
  const yTicks: number[] = []
  const step = rangeY > 30 ? 10 : 5
  for (let v = Math.ceil(minY / step) * step; v <= maxY; v += step) {
    yTicks.push(v)
  }

  // X-axis labels (show every ~5th day)
  const xLabels: Array<{ i: number; label: string }> = []
  const labelStep = Math.max(1, Math.floor(validPoints.length / 6))
  for (let i = 0; i < validPoints.length; i += labelStep) {
    const day = validPoints[i].date.slice(8, 10)
    xLabels.push({ i, label: day })
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-gray-400 font-medium">PR Diario</span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="w-4 h-0.5 bg-emerald-400 inline-block rounded" /> PR Clean
        </span>
        <span className="flex items-center gap-1 text-cyan-400">
          <span className="w-4 h-0.5 bg-cyan-400 inline-block rounded border-t border-dashed border-cyan-400" /> PR Modificado
        </span>
        <span className="flex items-center gap-1 text-yellow-500">
          <span className="w-4 h-0.5 bg-yellow-500 inline-block rounded" /> Garantia ({guarantee.toFixed(2)}%)
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={padX} y1={toY(v)} x2={W - 10} y2={toY(v)} stroke="#374151" strokeWidth={0.5} />
            <text x={padX - 4} y={toY(v) + 3} textAnchor="end" fill="#6b7280" fontSize="9">
              {v.toFixed(0)}%
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={toX(i)} y={H - 2} textAnchor="middle" fill="#6b7280" fontSize="9">
            {label}
          </text>
        ))}

        {/* Guarantee line */}
        <line
          x1={padX}
          y1={toY(guarantee)}
          x2={W - 10}
          y2={toY(guarantee)}
          stroke="#eab308"
          strokeWidth={1.5}
          strokeDasharray="6,3"
          opacity={0.7}
        />

        {/* PR Clean line */}
        <path d={cleanPath} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" />

        {/* PR Modified line (dashed) */}
        {modPath && (
          <path d={modPath} fill="none" stroke="#22d3ee" strokeWidth={1.5} strokeLinejoin="round" strokeDasharray="4,3" />
        )}

        {/* Dots for PR clean */}
        {validPoints.map((p, i) => (
          <circle key={i} cx={toX(i)} cy={toY(prValues[i])} r={2.5} fill="#10b981">
            <title>{`${p.date}: PR ${prValues[i].toFixed(2)}%`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}
