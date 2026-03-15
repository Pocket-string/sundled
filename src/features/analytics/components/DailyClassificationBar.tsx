'use client'

import type { DayClassification } from '../services/getDailyClassification'

interface Props {
  days: DayClassification[]
}

const CLASS_COLORS: Record<string, string> = {
  green: '#10b981',
  blue: '#22d3ee',
  orange: '#fb923c',
  red: '#ef4444',
  gray: '#4b5563',
}

const CLASS_LABELS: Record<string, string> = {
  green: '≥95%',
  blue: '80-95%',
  orange: '60-80%',
  red: '<60%',
  gray: 'Sin dato',
}

/**
 * Daily classification bar — receives pre-computed daily classifications
 * (using module-group P75 reference, matching the dashboard methodology).
 */
export function DailyClassificationBar({ days: dailyData }: Props) {
  if (dailyData.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Clasificacion diaria</h3>
          <p className="text-xs text-gray-600">Ref: P75 grupo de modulo · POA P95 por dia</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500">
          {Object.entries(CLASS_LABELS).map(([cls, label]) => (
            <span key={cls} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: CLASS_COLORS[cls] }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Horizontal color bar */}
      <div className="flex gap-0.5 h-8 rounded overflow-hidden">
        {dailyData.map((d) => (
          <div
            key={d.date}
            className="flex-1 relative group cursor-default"
            style={{ backgroundColor: CLASS_COLORS[d.class] }}
          >
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
              <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg border border-gray-700">
                <div className="font-medium">{d.date}</div>
                <div>
                  {d.ratio !== null ? `PI ${(d.ratio * 100).toFixed(1)}%` : 'Sin dato'}
                  {d.peakIntervals > 0 && ` · ${d.peakIntervals} peaks`}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Date labels */}
      <div className="flex justify-between text-xs text-gray-600">
        <span>{dailyData[0]?.date.substring(5)}</span>
        {dailyData.length > 2 && (
          <span>{dailyData[Math.floor(dailyData.length / 2)]?.date.substring(5)}</span>
        )}
        <span>{dailyData[dailyData.length - 1]?.date.substring(5)}</span>
      </div>

      {/* Summary table */}
      <div className="overflow-x-auto max-h-48">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900">
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-3 py-1.5 font-medium">Fecha</th>
              <th className="px-3 py-1.5 font-medium">Clase</th>
              <th className="px-3 py-1.5 font-medium text-right">PI ratio</th>
              <th className="px-3 py-1.5 font-medium text-right">Peaks</th>
              <th className="px-3 py-1.5 font-medium text-right">POA P95</th>
            </tr>
          </thead>
          <tbody>
            {[...dailyData].reverse().map((d) => (
              <tr key={d.date} className="border-b border-gray-800/50">
                <td className="px-3 py-1 text-gray-300">{d.date}</td>
                <td className="px-3 py-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: CLASS_COLORS[d.class] }}
                  />
                  <span className="text-gray-400">{CLASS_LABELS[d.class]}</span>
                </td>
                <td className="px-3 py-1 text-right tabular-nums" style={{ color: CLASS_COLORS[d.class] }}>
                  {d.ratio !== null ? `${(d.ratio * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="px-3 py-1 text-right text-gray-400 tabular-nums">{d.peakIntervals}</td>
                <td className="px-3 py-1 text-right text-gray-400 tabular-nums">
                  {d.poaThreshold !== null ? `${d.poaThreshold.toFixed(0)} W/m²` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
