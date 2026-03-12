'use client'

import { useHeatmapStore } from '../store/useHeatmapStore'
import type { AnalyticsSnapshot } from '@/features/analytics/types'
import { useRef, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  snapshots: AnalyticsSnapshot[]
  basePath: string
}

const STATUS_COLORS: Record<string, string> = {
  green: 'bg-emerald-400',
  blue: 'bg-cyan-400',
  orange: 'bg-orange-400',
  red: 'bg-red-400',
  gray: 'bg-gray-600',
}

export function HeatmapGrid({ snapshots, basePath }: Props) {
  const { filters, selectedStringId, setSelected } = useHeatmapStore()
  const selectedRef = useRef<HTMLTableRowElement>(null)

  // Apply filters
  const filtered = snapshots.filter((s) => {
    if (filters.ct) {
      const ct = s.svg_id?.match(/^(CT\d+)/)?.[1]
      if (ct !== filters.ct) return false
    }
    if (filters.inverter && s.inverter_id !== filters.inverter) return false
    if (filters.severity && s.class !== filters.severity) return false
    if (filters.search && !s.string_id.toLowerCase().includes(filters.search.toLowerCase())) return false
    return true
  })

  // Sort by ratio ascending (worst first)
  const sorted = [...filtered].sort((a, b) => (a.underperf_ratio ?? 999) - (b.underperf_ratio ?? 999))

  // Scroll selected row into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedStringId])

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 280px)' }}>
      <div className="p-3 border-b border-gray-800 flex-shrink-0">
        <span className="text-xs text-gray-500">{filtered.length} / {snapshots.length} strings</span>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-3 py-2 font-medium w-8"></th>
              <th className="px-3 py-2 font-medium">String</th>
              <th className="px-3 py-2 font-medium text-right">P (W)</th>
              <th className="px-3 py-2 font-medium text-right">P esp.</th>
              <th className="px-3 py-2 font-medium text-right">Ratio</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const isSelected = selectedStringId === s.string_id
              return (
                <tr
                  key={s.string_id}
                  ref={isSelected ? selectedRef : null}
                  onClick={() => setSelected(isSelected ? null : s.string_id)}
                  className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-gray-700/50' : 'hover:bg-gray-800/30'
                  }`}
                >
                  <td className="px-3 py-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[s.class]}`} />
                  </td>
                  <td className="px-3 py-1.5">
                    <Link
                      href={`${basePath}/strings/${encodeURIComponent(s.string_id)}`}
                      className="text-white hover:text-emerald-400 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {s.string_id}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-300">{s.p_string?.toFixed(0) ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right text-gray-300">{s.p_expected?.toFixed(0) ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right">
                    <span className={
                      s.class === 'green' ? 'text-emerald-400' :
                      s.class === 'blue' ? 'text-cyan-400' :
                      s.class === 'orange' ? 'text-orange-400' :
                      s.class === 'red' ? 'text-red-400' : 'text-gray-500'
                    }>
                      {s.underperf_ratio !== null ? `${(s.underperf_ratio * 100).toFixed(1)}%` : '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
