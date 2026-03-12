import type { StringLossStats } from '../services/getDailySummary'
import type { DailyStringSummary } from '../types'

interface Props {
  stats: StringLossStats
  history: DailyStringSummary[]
  energyPrice?: number // $/kWh — from plant config
}

const CLASS_COLORS: Record<string, string> = {
  green: 'bg-emerald-400',
  blue: 'bg-cyan-400',
  orange: 'bg-orange-400',
  red: 'bg-red-400',
  gray: 'bg-gray-600',
}

const CLASS_TEXT: Record<string, string> = {
  green: 'text-emerald-400',
  blue: 'text-cyan-400',
  orange: 'text-orange-400',
  red: 'text-red-400',
  gray: 'text-gray-500',
}

const CLASS_LABELS: Record<string, string> = {
  green: 'Optimo',
  blue: 'Media-alta',
  orange: 'Media-baja',
  red: 'Bajo',
  gray: 'Sin dato',
}

export function LossTracker({ stats, history, energyPrice }: Props) {
  if (stats.totalDaysWithData === 0) return null

  const lossKwh = stats.totalEnergyLossWh / 1000
  const dailyCost = energyPrice ? (stats.avgDailyLossWh / 1000) * energyPrice : null
  const totalCost = energyPrice ? lossKwh * energyPrice : null

  const isUnderperforming = stats.currentClass === 'orange' || stats.currentClass === 'red'

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">Rastreo de perdidas</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Current status + since when */}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Estado actual</p>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${CLASS_COLORS[stats.currentClass ?? 'gray']}`} />
              <span className={`text-lg font-bold ${CLASS_TEXT[stats.currentClass ?? 'gray']}`}>
                {CLASS_LABELS[stats.currentClass ?? 'gray']}
              </span>
              {stats.currentRatio !== null && (
                <span className="text-sm text-gray-400 ml-1">
                  ({(stats.currentRatio * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>

          {isUnderperforming && stats.underperformingSince && (
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-1">Bajo rendimiento desde</p>
              <p className="text-lg font-bold text-orange-400">{stats.underperformingSince}</p>
              <p className="text-xs text-gray-500">{stats.consecutiveDays} dias consecutivos</p>
            </div>
          )}
        </div>

        {/* Loss metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric
            label="Perdida total"
            value={lossKwh >= 1 ? `${lossKwh.toFixed(1)} kWh` : `${stats.totalEnergyLossWh} Wh`}
            sub={`en ${stats.totalDaysWithData} dias`}
          />
          <Metric
            label="Perdida promedio/dia"
            value={stats.avgDailyLossWh > 0 ? `${stats.avgDailyLossWh} Wh` : '0 Wh'}
            sub={`${stats.totalUnderperformingDays} dias con perdida`}
          />
          {totalCost !== null && (
            <Metric
              label="Costo total estimado"
              value={`$${totalCost.toFixed(2)}`}
              sub={`@ $${energyPrice}/kWh`}
              alert={totalCost > 10}
            />
          )}
          {dailyCost !== null && (
            <Metric
              label="Costo promedio/dia"
              value={`$${dailyCost.toFixed(2)}/dia`}
              sub="en dias con perdida"
              alert={dailyCost > 0.5}
            />
          )}
        </div>

        {/* Classification timeline — compact horizontal bar */}
        {history.length > 1 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Historial de clasificacion ({history.length} dias)
            </p>
            <div className="flex gap-px rounded overflow-hidden">
              {history.map((day) => (
                <div
                  key={day.date}
                  className={`h-4 flex-1 ${CLASS_COLORS[day.class]} opacity-80 hover:opacity-100 transition-opacity`}
                  title={`${day.date}: ${CLASS_LABELS[day.class]} (${day.underperf_ratio !== null ? (day.underperf_ratio * 100).toFixed(1) + '%' : 'sin dato'})${day.energy_loss_wh ? ` — perdida: ${day.energy_loss_wh.toFixed(0)} Wh` : ''}`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-600">{history[0]?.date}</span>
              <span className="text-[10px] text-gray-600">{history[history.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, sub, alert }: {
  label: string
  value: string
  sub?: string
  alert?: boolean
}) {
  return (
    <div className={`rounded-lg border p-3 ${alert ? 'border-red-500/40 bg-red-500/5' : 'border-gray-800'}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-base font-bold ${alert ? 'text-red-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-600">{sub}</p>}
    </div>
  )
}
