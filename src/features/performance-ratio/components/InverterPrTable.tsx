'use client'

import Link from 'next/link'
import type { InverterPrRow } from '../services/getPrDashboard'

interface Props {
  inverters: InverterPrRow[]
  plantId: string
  basePath?: string  // e.g. "/demo/PLT_A" or "/plants/PLT_A"
}

export function InverterPrTable({ inverters, plantId, basePath }: Props) {
  const linkBase = basePath ?? `/plants/${plantId}`
  if (inverters.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-gray-500 text-sm">
        Sin datos de inversores para este mes.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">
          Inversores ({inverters.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Inversor</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Wp (kWp)</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Prod (kWh)</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">PR Clean</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">PR Mod</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Disp %</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Disp Mod %</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">LAEC (kWh)</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">LAEO (kWh)</th>
            </tr>
          </thead>
          <tbody>
            {inverters.map(inv => {
              const prClean = inv.prCleanPct !== null ? (inv.prCleanPct * 100) : null
              const prMod = inv.prModifiedPct !== null ? (inv.prModifiedPct * 100) : null
              const avail = inv.availabilityPct !== null ? (inv.availabilityPct * 100) : null
              const availMod = inv.availabilityModifiedPct !== null ? (inv.availabilityModifiedPct * 100) : null

              return (
                <tr key={inv.inverterId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2">
                    <Link
                      href={`${linkBase}/strings/${encodeURIComponent(inv.inverterId)}`}
                      className="text-white hover:text-emerald-400 transition-colors"
                    >
                      {inv.inverterId}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-400">
                    {inv.peakPowerKwp?.toFixed(1) ?? '--'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-300">
                    {inv.totalProductionKwh !== null ? inv.totalProductionKwh.toFixed(0) : '--'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <PrValue value={prClean} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <PrValue value={prMod} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <AvailValue value={avail} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <AvailValue value={availMod} />
                  </td>
                  <td className="px-4 py-2 text-right text-gray-400">
                    {inv.totalLaecKwh > 0 ? inv.totalLaecKwh.toFixed(1) : '0'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-400">
                    {inv.totalLaeoKwh > 0 ? inv.totalLaeoKwh.toFixed(1) : '0'}
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

function PrValue({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-600">--</span>
  const color =
    value >= 80 ? 'text-emerald-400' :
    value >= 70 ? 'text-yellow-400' :
    'text-red-400'
  return <span className={color}>{value.toFixed(2)}%</span>
}

function AvailValue({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-600">--</span>
  const color =
    value >= 99 ? 'text-emerald-400' :
    value >= 95 ? 'text-yellow-400' :
    'text-red-400'
  return <span className={color}>{value.toFixed(2)}%</span>
}
