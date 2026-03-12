'use client'

/**
 * Donut chart equivalent to Power BI "Strings y su Rendimiento"
 * DAX: Perf_Bins.Bucket + TablaSVG.Strings por Bin
 *
 * Shows distribution of strings by performance class (green/yellow/red/gray)
 * as a donut chart with absolute counts and percentages.
 */

interface Props {
  greenCount: number
  blueCount: number
  orangeCount: number
  redCount: number
  grayCount: number
  totalStrings: number
}

interface Segment {
  label: string
  count: number
  color: string
  tailwind: string
}

export function PerformanceDonut({ greenCount, blueCount, orangeCount, redCount, grayCount, totalStrings }: Props) {
  if (totalStrings === 0) return null

  const segments: Segment[] = [
    { label: 'Optimo (≥95%)', count: greenCount, color: '#34d399', tailwind: 'bg-emerald-400' },
    { label: 'Media-alta (80–95%)', count: blueCount, color: '#22d3ee', tailwind: 'bg-cyan-400' },
    { label: 'Media-baja (60–80%)', count: orangeCount, color: '#fb923c', tailwind: 'bg-orange-400' },
    { label: 'Bajo (<60%)', count: redCount, color: '#f87171', tailwind: 'bg-red-400' },
    { label: 'Sin dato', count: grayCount, color: '#6b7280', tailwind: 'bg-gray-500' },
  ].filter(s => s.count > 0)

  // SVG donut chart
  const size = 180
  const cx = size / 2
  const cy = size / 2
  const outerR = 75
  const innerR = 50
  const paths = buildDonutPaths(segments, cx, cy, outerR, innerR, totalStrings)

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 className="text-sm font-semibold text-white mb-4">Strings y su Rendimiento</h3>
      <div className="flex flex-col items-center gap-4">
        {/* Donut SVG */}
        <div className="flex-shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {paths.map((p, i) => (
              <path key={i} d={p.d} fill={p.color} />
            ))}
            {/* Center text */}
            <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">
              {totalStrings}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fill="#9ca3af" fontSize="11">
              strings
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1.5 w-full">
          {segments.map((seg) => {
            const pct = ((seg.count / totalStrings) * 100).toFixed(1)
            return (
              <div key={seg.label} className="flex items-center gap-2 text-sm">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${seg.tailwind}`} />
                <span className="text-gray-300 text-xs">{seg.label}</span>
                <span className="text-white font-medium ml-auto tabular-nums">{seg.count}</span>
                <span className="text-gray-500 text-xs w-14 text-right tabular-nums">({pct}%)</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function buildDonutPaths(
  segments: Segment[],
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  total: number
): { d: string; color: string }[] {
  const paths: { d: string; color: string }[] = []
  let currentAngle = -Math.PI / 2 // Start from top

  for (const seg of segments) {
    const angle = (seg.count / total) * 2 * Math.PI
    if (angle === 0) continue

    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    const largeArc = angle > Math.PI ? 1 : 0

    const x1o = cx + outerR * Math.cos(startAngle)
    const y1o = cy + outerR * Math.sin(startAngle)
    const x2o = cx + outerR * Math.cos(endAngle)
    const y2o = cy + outerR * Math.sin(endAngle)
    const x1i = cx + innerR * Math.cos(endAngle)
    const y1i = cy + innerR * Math.sin(endAngle)
    const x2i = cx + innerR * Math.cos(startAngle)
    const y2i = cy + innerR * Math.sin(startAngle)

    // Handle full circle (single segment = 100%)
    if (Math.abs(angle - 2 * Math.PI) < 0.001) {
      const midAngle = startAngle + Math.PI
      const mx1o = cx + outerR * Math.cos(midAngle)
      const my1o = cy + outerR * Math.sin(midAngle)
      const mx1i = cx + innerR * Math.cos(midAngle)
      const my1i = cy + innerR * Math.sin(midAngle)

      paths.push({
        d: [
          `M ${x1o} ${y1o}`,
          `A ${outerR} ${outerR} 0 0 1 ${mx1o} ${my1o}`,
          `A ${outerR} ${outerR} 0 0 1 ${x1o} ${y1o}`,
          `M ${x2i} ${y2i}`,
          `A ${innerR} ${innerR} 0 0 0 ${mx1i} ${my1i}`,
          `A ${innerR} ${innerR} 0 0 0 ${x2i} ${y2i}`,
          'Z',
        ].join(' '),
        color: seg.color,
      })
    } else {
      paths.push({
        d: [
          `M ${x1o} ${y1o}`,
          `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o}`,
          `L ${x1i} ${y1i}`,
          `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i}`,
          'Z',
        ].join(' '),
        color: seg.color,
      })
    }

    currentAngle = endAngle
  }

  return paths
}
