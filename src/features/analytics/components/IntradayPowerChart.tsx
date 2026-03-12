'use client'

import { useMemo } from 'react'
import type { IntradayPoint } from '../services/getIntradayPower'

/**
 * Line chart equivalent to Power BI "Potencia de Strings (W)"
 * DAX: CountNonNull(Fact_String.P_string) by Fecha
 *
 * Shows intraday power profile: average P_string per timestamp
 * with a secondary axis for POA (irradiance).
 * Highlights the currently selected timestamp if provided.
 */

interface Props {
  points: IntradayPoint[]
  currentTs?: string | null
}

export function IntradayPowerChart({ points, currentTs }: Props) {
  if (points.length === 0) return null

  const chart = useMemo(() => {
    const W = 700
    const H = 220
    const pad = { top: 20, right: 60, bottom: 30, left: 55 }
    const plotW = W - pad.left - pad.right
    const plotH = H - pad.top - pad.bottom

    const maxPower = Math.max(...points.map(p => p.avgPower), 1)
    const maxPoa = Math.max(...points.map(p => p.avgPoa), 1)

    const scaleX = (i: number) => pad.left + (i / (points.length - 1)) * plotW
    const scaleYPower = (v: number) => pad.top + plotH - (v / maxPower) * plotH
    const scaleYPoa = (v: number) => pad.top + plotH - (v / maxPoa) * plotH

    // Power line path
    const powerLine = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)} ${scaleYPower(p.avgPower).toFixed(1)}`)
      .join(' ')

    // Power area fill
    const powerArea = powerLine +
      ` L ${scaleX(points.length - 1).toFixed(1)} ${(pad.top + plotH).toFixed(1)}` +
      ` L ${scaleX(0).toFixed(1)} ${(pad.top + plotH).toFixed(1)} Z`

    // POA line path (dashed)
    const poaLine = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)} ${scaleYPoa(p.avgPoa).toFixed(1)}`)
      .join(' ')

    // Find current timestamp index
    const currentIdx = currentTs ? points.findIndex(p => p.ts === currentTs) : -1

    // X-axis labels (show every ~4th label)
    const step = Math.max(1, Math.floor(points.length / 8))
    const xLabels = points.filter((_, i) => i % step === 0 || i === points.length - 1)

    // Y-axis labels for power
    const ySteps = 5
    const yPowerLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
      const v = (maxPower / ySteps) * i
      return { value: Math.round(v), y: scaleYPower(v) }
    })

    // Y-axis labels for POA (right side)
    const yPoaLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
      const v = (maxPoa / ySteps) * i
      return { value: Math.round(v), y: scaleYPoa(v) }
    })

    return {
      W, H, pad, plotW, plotH,
      maxPower, maxPoa,
      scaleX, scaleYPower, scaleYPoa,
      powerLine, powerArea, poaLine,
      currentIdx,
      xLabels, yPowerLabels, yPoaLabels, step,
    }
  }, [points, currentTs])

  const {
    W, H, pad, plotH,
    powerLine, powerArea, poaLine,
    currentIdx,
    xLabels, yPowerLabels, yPoaLabels, step,
  } = chart

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Potencia de Strings (W)</h3>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Potencia promedio
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-amber-400/60 inline-block" style={{ borderTop: '1px dashed #fbbf24' }} /> POA
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {yPowerLabels.map((l, i) => (
          <line
            key={`grid-${i}`}
            x1={pad.left}
            x2={W - pad.right}
            y1={l.y}
            y2={l.y}
            stroke="#374151"
            strokeWidth="0.5"
          />
        ))}

        {/* Power area fill */}
        <path d={powerArea} fill="url(#powerGrad)" opacity="0.3" />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* POA line (dashed) */}
        <path
          d={poaLine}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.6"
        />

        {/* Power line */}
        <path d={powerLine} fill="none" stroke="#34d399" strokeWidth="2" />

        {/* Current timestamp marker */}
        {currentIdx >= 0 && (
          <>
            <line
              x1={chart.scaleX(currentIdx)}
              x2={chart.scaleX(currentIdx)}
              y1={pad.top}
              y2={pad.top + plotH}
              stroke="#60a5fa"
              strokeWidth="1.5"
              strokeDasharray="3 2"
            />
            <circle
              cx={chart.scaleX(currentIdx)}
              cy={chart.scaleYPower(points[currentIdx].avgPower)}
              r="4"
              fill="#34d399"
              stroke="#111827"
              strokeWidth="2"
            />
            <circle
              cx={chart.scaleX(currentIdx)}
              cy={chart.scaleYPoa(points[currentIdx].avgPoa)}
              r="3"
              fill="#fbbf24"
              stroke="#111827"
              strokeWidth="2"
            />
          </>
        )}

        {/* X-axis labels */}
        {xLabels.map((p) => {
          const idx = points.indexOf(p)
          return (
            <text
              key={p.ts}
              x={chart.scaleX(idx)}
              y={H - 5}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize="10"
            >
              {p.hour}
            </text>
          )
        })}

        {/* Y-axis labels (left - Power) */}
        {yPowerLabels.map((l, i) => (
          <text
            key={`yp-${i}`}
            x={pad.left - 6}
            y={l.y + 3}
            textAnchor="end"
            fill="#9ca3af"
            fontSize="9"
          >
            {l.value}
          </text>
        ))}

        {/* Y-axis labels (right - POA) */}
        {yPoaLabels.map((l, i) => (
          <text
            key={`ypoa-${i}`}
            x={W - pad.right + 6}
            y={l.y + 3}
            textAnchor="start"
            fill="#fbbf24"
            fontSize="9"
            opacity="0.6"
          >
            {l.value}
          </text>
        ))}

        {/* Axis labels */}
        <text x={12} y={pad.top + plotH / 2} textAnchor="middle" fill="#9ca3af" fontSize="9" transform={`rotate(-90, 12, ${pad.top + plotH / 2})`}>
          W (promedio)
        </text>
        <text x={W - 8} y={pad.top + plotH / 2} textAnchor="middle" fill="#fbbf24" fontSize="9" opacity="0.6" transform={`rotate(90, ${W - 8}, ${pad.top + plotH / 2})`}>
          POA (W/m²)
        </text>
      </svg>

      {/* Current timestamp info */}
      {currentIdx >= 0 && (
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 border-t border-gray-800 pt-2">
          <span>Seleccionado: <span className="text-white font-medium">{points[currentIdx].hour}</span></span>
          <span>P prom: <span className="text-emerald-400 font-medium">{points[currentIdx].avgPower} W</span></span>
          <span>POA: <span className="text-amber-400 font-medium">{points[currentIdx].avgPoa} W/m²</span></span>
          <span>Strings activos: <span className="text-white font-medium">{points[currentIdx].stringCount}</span></span>
        </div>
      )}
    </div>
  )
}
