import type { PlantInsight } from '../types'

const SEVERITY_STYLES = {
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  critical: 'border-red-500/30 bg-red-500/10 text-red-400',
}

const TYPE_LABELS = {
  performance: 'Rendimiento',
  anomaly: 'Anomalia',
  recommendation: 'Recomendacion',
  summary: 'Resumen',
}

export function InsightCard({ insight }: { insight: PlantInsight }) {
  return (
    <div className={`rounded-xl border p-4 ${SEVERITY_STYLES[insight.severity]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider">{TYPE_LABELS[insight.type]}</span>
        {insight.metric && (
          <span className="text-lg font-bold">{insight.metric.value} {insight.metric.unit}</span>
        )}
      </div>
      <h4 className="font-semibold text-white text-sm mb-1">{insight.title}</h4>
      <p className="text-xs opacity-80">{insight.description}</p>
      {insight.affectedStrings && insight.affectedStrings.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {insight.affectedStrings.slice(0, 5).map(s => (
            <span key={s} className="text-[10px] bg-white/10 rounded px-1.5 py-0.5">{s}</span>
          ))}
          {insight.affectedStrings.length > 5 && (
            <span className="text-[10px] opacity-60">+{insight.affectedStrings.length - 5} mas</span>
          )}
        </div>
      )}
    </div>
  )
}
