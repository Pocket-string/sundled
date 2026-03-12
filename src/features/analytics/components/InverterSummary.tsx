import type { AnalyticsSnapshot } from '../types'
import Link from 'next/link'

interface Props {
  snapshots: AnalyticsSnapshot[]
  basePath: string // '/demo/PLT_A' or '/plants/uuid'
  currentDate?: string | null
}

interface InverterRow {
  inverter_id: string
  total: number
  green: number
  blue: number
  orange: number
  red: number
  gray: number
}

/**
 * Natural sort for inverter IDs: INV 1-1, INV 1-2, ..., INV 2-1, ..., INV 3-1
 * Extracts CT number and inverter sub-number for proper ordering.
 */
function inverterSortKey(id: string): [number, number] {
  const match = id.match(/INV\s*(\d+)-(\d+)/)
  if (match) return [parseInt(match[1], 10), parseInt(match[2], 10)]
  return [999, 999]
}

export function InverterSummary({ snapshots, basePath, currentDate }: Props) {
  const inverterMap = new Map<string, InverterRow>()

  for (const s of snapshots) {
    const inv = s.inverter_id ?? 'Sin inversor'
    const row = inverterMap.get(inv) ?? { inverter_id: inv, total: 0, green: 0, blue: 0, orange: 0, red: 0, gray: 0 }
    row.total++
    row[s.class]++
    inverterMap.set(inv, row)
  }

  // Natural sort: INV 1-1, INV 1-2, ..., INV 2-1, ..., INV 3-1
  const rows = Array.from(inverterMap.values())
    .sort((a, b) => {
      const [aCt, aNum] = inverterSortKey(a.inverter_id)
      const [bCt, bNum] = inverterSortKey(b.inverter_id)
      if (aCt !== bCt) return aCt - bCt
      return aNum - bNum
    })

  if (rows.length === 0) return null

  const dateParam = currentDate ? `?date=${currentDate}` : ''

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">Resumen por inversor</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-4 py-2 font-medium">Inversor</th>
              <th className="px-4 py-2 font-medium text-center">Total</th>
              <th className="px-4 py-2 font-medium text-center">
                <span className="text-emerald-400">Optimo</span>
              </th>
              <th className="px-4 py-2 font-medium text-center">
                <span className="text-cyan-400">Media-alta</span>
              </th>
              <th className="px-4 py-2 font-medium text-center">
                <span className="text-orange-400">Media-baja</span>
              </th>
              <th className="px-4 py-2 font-medium text-center">
                <span className="text-red-400">Bajo</span>
              </th>
              <th className="px-4 py-2 font-medium text-center">
                <span className="text-gray-500">Sin dato</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.inverter_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-2">
                  <Link
                    href={`${basePath}/inverter/${encodeURIComponent(r.inverter_id)}${dateParam}`}
                    className="text-white hover:text-emerald-400 transition-colors font-medium"
                  >
                    {r.inverter_id}
                  </Link>
                </td>
                <td className="px-4 py-2 text-center text-gray-300">{r.total}</td>
                <td className="px-4 py-2 text-center text-emerald-400">{r.green || '—'}</td>
                <td className="px-4 py-2 text-center text-cyan-400">{r.blue || '—'}</td>
                <td className="px-4 py-2 text-center text-orange-400">{r.orange || '—'}</td>
                <td className="px-4 py-2 text-center text-red-400">{r.red || '—'}</td>
                <td className="px-4 py-2 text-center text-gray-500">{r.gray || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
