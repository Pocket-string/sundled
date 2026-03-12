'use client'

import { useState, useMemo } from 'react'

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

type ViewMode = 'p_poa' | 'i_v'

const VIEW_CONFIG: Record<ViewMode, {
  label: string
  leftKey: keyof DataPoint
  rightKey: keyof DataPoint
  leftLabel: string
  rightLabel: string
  leftUnit: string
  rightUnit: string
  leftColor: string
  rightColor: string
}> = {
  p_poa: {
    label: 'Potencia vs POA',
    leftKey: 'p',
    rightKey: 'poa',
    leftLabel: 'Potencia',
    rightLabel: 'POA',
    leftUnit: 'W',
    rightUnit: 'W/m²',
    leftColor: '#10b981',
    rightColor: '#f59e0b',
  },
  i_v: {
    label: 'Corriente vs Voltaje',
    leftKey: 'i',
    rightKey: 'v',
    leftLabel: 'Corriente',
    rightLabel: 'Voltaje',
    leftUnit: 'A',
    rightUnit: 'V',
    leftColor: '#3b82f6',
    rightColor: '#f59e0b',
  },
}

/**
 * Dual-axis SVG chart for comparing two variables with different scales.
 * Normalizes each series to [0, 1] and draws both on same chart.
 * Left Y axis shows one variable, right Y axis shows the other.
 */
export function RawDualChart({ data }: Props) {
  const [view, setView] = useState<ViewMode>('p_poa')

  const config = VIEW_CONFIG[view]

  const { leftValues, rightValues, leftMin, leftMax, rightMin, rightMax } = useMemo(() => {
    const lv = data.map((d) => d[config.leftKey] as number | null)
    const rv = data.map((d) => d[config.rightKey] as number | null)
    const validL = lv.filter((v): v is number => v !== null)
    const validR = rv.filter((v): v is number => v !== null)
    return {
      leftValues: lv,
      rightValues: rv,
      leftMin: validL.length > 0 ? Math.min(...validL) : 0,
      leftMax: validL.length > 0 ? Math.max(...validL) : 1,
      rightMin: validR.length > 0 ? Math.min(...validR) : 0,
      rightMax: validR.length > 0 ? Math.max(...validR) : 1,
    }
  }, [data, config.leftKey, config.rightKey])

  const chartWidth = 800
  const chartHeight = 220
  const padX = 50
  const padY = 10
  const innerW = chartWidth - 2 * padX
  const innerH = chartHeight - 2 * padY

  const leftRange = leftMax - leftMin || 1
  const rightRange = rightMax - rightMin || 1

  const toX = (i: number) => padX + (i / Math.max(data.length - 1, 1)) * innerW
  const toYLeft = (v: number) => padY + (1 - (v - leftMin) / leftRange) * innerH
  const toYRight = (v: number) => padY + (1 - (v - rightMin) / rightRange) * innerH

  const leftPath = buildPath(leftValues, toX, toYLeft)
  const rightPath = buildPath(rightValues, toX, toYRight)

  // Y axis tick values
  const leftTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => leftMin + f * leftRange)
  const rightTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => rightMin + f * rightRange)

  // X axis date labels
  const dateLabels = useMemo(() => {
    if (data.length === 0) return []
    const labels: { idx: number; label: string }[] = []
    let lastDate = ''
    for (let i = 0; i < data.length; i++) {
      const d = data[i].ts.substring(0, 10)
      if (d !== lastDate) {
        labels.push({ idx: i, label: d.substring(5) })
        lastDate = d
      }
    }
    // Show at most 7 labels
    if (labels.length > 7) {
      const step = Math.ceil(labels.length / 7)
      return labels.filter((_, i) => i % step === 0)
    }
    return labels
  }, [data])

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
      {/* View tabs */}
      <div className="flex items-center gap-1">
        {(Object.keys(VIEW_CONFIG) as ViewMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setView(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === m ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {VIEW_CONFIG[m].label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: config.leftColor }} />
          <span className="text-gray-400">{config.leftLabel} ({config.leftUnit})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 inline-block"
            style={{ borderTop: `2px dashed ${config.rightColor}`, height: 0 }}
          />
          <span className="text-gray-400">{config.rightLabel} ({config.rightUnit})</span>
        </span>
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-56">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, fi) => {
          const y = padY + (1 - frac) * innerH
          return (
            <g key={frac}>
              <line x1={padX} y1={y} x2={chartWidth - padX} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              {/* Left axis labels */}
              <text x={padX - 4} y={y + 3} textAnchor="end" fill={config.leftColor} fontSize="9" opacity={0.7}>
                {formatTick(leftTicks[fi], config.leftUnit)}
              </text>
              {/* Right axis labels */}
              <text x={chartWidth - padX + 4} y={y + 3} textAnchor="start" fill={config.rightColor} fontSize="9" opacity={0.7}>
                {formatTick(rightTicks[fi], config.rightUnit)}
              </text>
            </g>
          )
        })}

        {/* Date labels on X axis */}
        {dateLabels.map((dl) => (
          <text
            key={dl.idx}
            x={toX(dl.idx)}
            y={chartHeight - 1}
            textAnchor="middle"
            fill="rgba(255,255,255,0.3)"
            fontSize="8"
          >
            {dl.label}
          </text>
        ))}

        {/* Right series (dashed, drawn first so left is on top) */}
        {rightPath && (
          <path
            d={rightPath}
            fill="none"
            stroke={config.rightColor}
            strokeWidth={1.2}
            strokeDasharray="4,3"
            strokeLinejoin="round"
            opacity={0.8}
          />
        )}

        {/* Left series (solid) */}
        {leftPath && (
          <path
            d={leftPath}
            fill="none"
            stroke={config.leftColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  )
}

function buildPath(
  values: (number | null)[],
  toX: (i: number) => number,
  toY: (v: number) => number
): string | null {
  const segments: string[] = []
  let inPath = false

  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v === null) {
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

function formatTick(val: number, unit: string): string {
  if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`
  if (Math.abs(val) >= 10) return val.toFixed(0)
  return val.toFixed(1)
}
