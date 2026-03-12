'use client'

import { useRef, useCallback, type MouseEvent } from 'react'
import { useHeatmapStore } from '../store/useHeatmapStore'
import type { AnalyticsSnapshot } from '@/features/analytics/types'
import { interpolateRdYlGn } from 'd3-scale-chromatic'
import { scaleLinear } from 'd3-scale'

interface SvgRect {
  svg_id: string
  x: number
  y: number
  width: number
  height: number
}

interface Props {
  layout: SvgRect[]
  snapshots: AnalyticsSnapshot[]
  plantId: string
}

const STATUS_COLORS: Record<string, string> = {
  green: '#10b981',
  blue: '#22d3ee',
  orange: '#fb923c',
  red: '#ef4444',
  gray: '#4b5563',
}

// Original SVG dimensions from svg_strings_selectable_clean.svg
const BASE_W = 748
const BASE_H = 707
const PADDING = 15
const VIEWBOX = `${-PADDING} ${-PADDING} ${BASE_W + PADDING * 2} ${BASE_H + PADDING * 2}`

export function SvgHeatmap({ layout, snapshots, plantId }: Props) {
  const { metric, filters, selectedStringId, hoveredStringId, setSelected, setHovered } = useHeatmapStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })
  const isPanningRef = useRef(false)

  // Build snapshot lookup by svg_id
  const snapshotMap = new Map<string, AnalyticsSnapshot>()
  for (const s of snapshots) {
    if (s.svg_id) snapshotMap.set(s.svg_id, s)
  }

  // Build color scale for continuous metrics
  const continuousScale = buildContinuousScale(snapshots, metric)

  // Derive CT section bands from rect positions
  const ctSections = new Map<string, { minY: number; maxY: number }>()
  for (const rect of layout) {
    const ct = rect.svg_id.match(/^(CT\d+)/)?.[1]
    if (ct) {
      const section = ctSections.get(ct)
      if (section) {
        section.minY = Math.min(section.minY, rect.y)
        section.maxY = Math.max(section.maxY, rect.y + rect.height)
      } else {
        ctSections.set(ct, { minY: rect.y, maxY: rect.y + rect.height })
      }
    }
  }

  // Check if a snapshot passes filters
  const passesFilter = (snapshot: AnalyticsSnapshot | undefined, svgId: string): boolean => {
    if (filters.ct) {
      const ct = svgId.match(/^(CT\d+)/)?.[1]
      if (ct !== filters.ct) return false
    }
    if (!snapshot) return !filters.inverter && !filters.severity && !filters.search
    if (filters.inverter && snapshot.inverter_id !== filters.inverter) return false
    if (filters.severity && snapshot.class !== filters.severity) return false
    if (filters.search && !snapshot.string_id.toLowerCase().includes(filters.search.toLowerCase())) return false
    return true
  }

  // Get rect color based on metric
  const getRectColor = (snapshot: AnalyticsSnapshot | undefined): string => {
    if (!snapshot) return STATUS_COLORS.gray

    if (metric === 'class') {
      return STATUS_COLORS[snapshot.class]
    }

    const value = getMetricValue(snapshot, metric)
    if (value === null) return STATUS_COLORS.gray

    if (continuousScale) {
      const normalized = continuousScale(value)
      return interpolateRdYlGn(normalized)
    }
    return STATUS_COLORS.gray
  }

  // Pan handlers
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0 || !containerRef.current) return
    isPanningRef.current = true
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanningRef.current || !containerRef.current) return
    containerRef.current.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x)
    containerRef.current.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y)
  }, [])

  const handleMouseUp = useCallback(() => { isPanningRef.current = false }, [])

  if (layout.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-500">
        Sin layout SVG configurado.
      </div>
    )
  }

  const selectedSnapshot = selectedStringId
    ? snapshots.find((s) => s.string_id === selectedStringId)
    : null

  return (
    <div className="flex gap-4">
      {/* SVG Heatmap */}
      <div className="flex-1 rounded-xl border border-gray-800 bg-gray-900 p-4 relative">
        <div
          ref={containerRef}
          className="overflow-auto"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            ref={svgRef}
            viewBox={VIEWBOX}
            className="select-none mx-auto"
            style={{ maxHeight: 'calc(100vh - 300px)', maxWidth: '100%', height: 'auto', width: 'auto' }}
          >
            {/* CT Section labels */}
            {Array.from(ctSections.entries()).map(([ct, { minY, maxY }]) => (
              <text
                key={ct}
                x={-6}
                y={(minY + maxY) / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#9ca3af"
                fontSize="14"
                fontWeight="bold"
                transform={`rotate(-90, -6, ${(minY + maxY) / 2})`}
              >
                {ct}
              </text>
            ))}

            {/* String rects */}
            {layout.map((rect) => {
              const snapshot = snapshotMap.get(rect.svg_id)
              const passes = passesFilter(snapshot, rect.svg_id)
              const isSelected = selectedStringId === snapshot?.string_id
              const isHovered = hoveredStringId === snapshot?.string_id
              const color = getRectColor(snapshot)

              return (
                <rect
                  key={rect.svg_id}
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  fill={color}
                  fillOpacity={passes ? (snapshot ? 0.85 : 0.3) : 0.1}
                  stroke={isSelected ? '#fff' : isHovered ? '#94a3b8' : 'rgba(255,255,255,0.1)'}
                  strokeWidth={isSelected ? 2 : isHovered ? 1 : 0.5}
                  className="cursor-pointer"
                  opacity={passes ? 1 : 0.3}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (snapshot) {
                      setSelected(isSelected ? null : snapshot.string_id)
                    }
                  }}
                  onMouseEnter={() => snapshot && setHovered(snapshot.string_id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <title>
                    {snapshot
                      ? `${snapshot.string_id}\n${formatMetricLabel(metric)}: ${formatMetricValue(snapshot, metric)}\nClase: ${snapshot.class}`
                      : rect.svg_id}
                  </title>
                </rect>
              )
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          {metric === 'class' ? (
            <>
              <LegendItem color={STATUS_COLORS.green} label="Optimo (>=95%)" />
              <LegendItem color={STATUS_COLORS.blue} label="Media-alta (80-95%)" />
              <LegendItem color={STATUS_COLORS.orange} label="Media-baja (60-80%)" />
              <LegendItem color={STATUS_COLORS.red} label="Bajo (<60%)" />
              <LegendItem color={STATUS_COLORS.gray} label="Sin dato" />
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-gray-500">{formatMetricLabel(metric)}:</span>
              <div className="flex h-3 w-32 rounded overflow-hidden">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{ backgroundColor: interpolateRdYlGn(i / 19) }}
                  />
                ))}
              </div>
              <span className="text-gray-500">bajo → alto</span>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedSnapshot && (
        <div className="w-72 rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">{selectedSnapshot.string_id}</h4>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-500 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[selectedSnapshot.class] }} />
            <span className={`text-sm ${
              selectedSnapshot.class === 'green' ? 'text-emerald-400' :
              selectedSnapshot.class === 'blue' ? 'text-cyan-400' :
              selectedSnapshot.class === 'orange' ? 'text-orange-400' :
              selectedSnapshot.class === 'red' ? 'text-red-400' : 'text-gray-500'
            }`}>
              {selectedSnapshot.underperf_ratio !== null ? `${(selectedSnapshot.underperf_ratio * 100).toFixed(1)}%` : 'Sin dato'}
            </span>
          </div>

          <dl className="text-sm space-y-1.5">
            <DetailRow label="Inversor" value={selectedSnapshot.inverter_id ?? '—'} />
            <DetailRow label="Peer group" value={selectedSnapshot.peer_group ?? '—'} />
            <DetailRow label="P string" value={selectedSnapshot.p_string !== null ? `${selectedSnapshot.p_string.toFixed(0)} W` : '—'} />
            <DetailRow label="P esperado" value={selectedSnapshot.p_expected !== null ? `${selectedSnapshot.p_expected.toFixed(0)} W` : '—'} />
            <DetailRow label="Delta" value={selectedSnapshot.underperf_delta_w !== null ? `${selectedSnapshot.underperf_delta_w.toFixed(0)} W` : '—'} />
            <DetailRow label="POA" value={selectedSnapshot.poa !== null ? `${selectedSnapshot.poa.toFixed(0)} W/m²` : '—'} />
            <DetailRow label="Metodo" value={formatMethod(selectedSnapshot.reference_method)} />
            <DetailRow label="Muestras" value={selectedSnapshot.reference_sample_size.toString()} />
          </dl>

          <a
            href={`/demo/${plantId}/strings/${encodeURIComponent(selectedSnapshot.string_id)}`}
            className="block w-full text-center px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-emerald-400 text-sm font-medium transition-colors"
          >
            Ver detalle completo
          </a>
        </div>
      )}
    </div>
  )
}

// --- Helpers ---

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-300">{value}</dd>
    </div>
  )
}

function getMetricValue(s: AnalyticsSnapshot, metric: string): number | null {
  switch (metric) {
    case 'underperf_ratio': return s.underperf_ratio
    case 'p_string': return s.p_string
    case 'p_expected': return s.p_expected
    default: return null
  }
}

function buildContinuousScale(snapshots: AnalyticsSnapshot[], metric: string) {
  if (metric === 'class') return null

  const values = snapshots
    .map((s) => getMetricValue(s, metric))
    .filter((v): v is number => v !== null)

  if (values.length === 0) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return () => 0.5

  return scaleLinear().domain([min, max]).range([0, 1]).clamp(true)
}

function formatMetricLabel(metric: string): string {
  switch (metric) {
    case 'class': return 'Clasificacion'
    case 'underperf_ratio': return 'Ratio'
    case 'p_string': return 'P string (W)'
    case 'p_expected': return 'P esperado (W)'
    default: return metric
  }
}

function formatMetricValue(s: AnalyticsSnapshot, metric: string): string {
  const v = metric === 'class' ? null : getMetricValue(s, metric)
  if (metric === 'class') return s.class
  if (v === null) return '—'
  if (metric === 'underperf_ratio') return `${(v * 100).toFixed(1)}%`
  return v.toFixed(0)
}

function formatMethod(method: string): string {
  switch (method) {
    case 'module_group_p75': return 'P75 modulo'
    case 'same_string_p75': return 'P75 mismo'
    case 'same_string_relaxed_p75': return 'P75 relajado'
    case 'peer_group_fallback': return 'Grupo par'
    case 'insufficient_data': return 'Sin ref.'
    default: return method
  }
}
