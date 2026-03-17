'use client'

import type { PrKpis } from '../services/getPrDashboard'

interface Props {
  kpis: PrKpis
}

export function PrKpiCards({ kpis }: Props) {
  const prClean = kpis.prCleanPct !== null ? (kpis.prCleanPct * 100) : null
  const prMod = kpis.prModifiedPct !== null ? (kpis.prModifiedPct * 100) : null
  const avail = kpis.availabilityPct !== null ? (kpis.availabilityPct * 100) : null
  const availMod = kpis.availabilityModifiedPct !== null ? (kpis.availabilityModifiedPct * 100) : null
  const prodMwh = kpis.totalProductionKwh !== null ? (kpis.totalProductionKwh / 1000) : null
  const meterMwh = kpis.meterProductionKwh !== null ? (kpis.meterProductionKwh / 1000) : null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <KpiCard
        label="PR Clean"
        value={prClean !== null ? `${prClean.toFixed(2)}%` : '--'}
        target={`Garantia: ${(kpis.guaranteedPrPct * 100).toFixed(2)}%`}
        status={prClean !== null ? (prClean >= kpis.guaranteedPrPct * 100 ? 'good' : 'bad') : 'neutral'}
      />
      <KpiCard
        label="PR Modificado"
        value={prMod !== null ? `${prMod.toFixed(2)}%` : '--'}
        target="Excluye indisponibilidad operador"
        status="neutral"
      />
      <KpiCard
        label="Disp. Clean"
        value={avail !== null ? `${avail.toFixed(2)}%` : '--'}
        target={`Garantia: ${(kpis.guaranteedAvailabilityPct * 100).toFixed(1)}%`}
        status={avail !== null ? (avail >= kpis.guaranteedAvailabilityPct * 100 ? 'good' : 'bad') : 'neutral'}
      />
      <KpiCard
        label="Disp. Modificada"
        value={availMod !== null ? `${availMod.toFixed(2)}%` : '--'}
        target="Excluye indisponibilidad operador"
        status="neutral"
      />
      <KpiCard
        label="Produccion"
        value={prodMwh !== null ? `${prodMwh.toFixed(1)} MWh` : '--'}
        status="neutral"
      />
      <KpiCard
        label="Medidor PMGD"
        value={meterMwh !== null ? `${meterMwh.toFixed(1)} MWh` : '--'}
        status="neutral"
      />
    </div>
  )
}

function KpiCard({
  label,
  value,
  target,
  status,
}: {
  label: string
  value: string
  target?: string
  status: 'good' | 'bad' | 'neutral'
}) {
  const valueColor =
    status === 'good' ? 'text-emerald-400' :
    status === 'bad' ? 'text-red-400' :
    'text-white'

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      {target && <p className="text-xs text-gray-600 mt-1">{target}</p>}
    </div>
  )
}
