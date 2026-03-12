'use client'

import { useState, useMemo } from 'react'
import type { AnalyticsSnapshot } from '../types'
import type { DayClassification } from '../services/getDailyClassification'
import { ComparisonTimeSeries } from './ComparisonTimeSeries'
import { RatioTimeSeries } from './RatioTimeSeries'
import { DailyClassificationBar } from './DailyClassificationBar'
import { RawDualChart } from './RawDualChart'

type TimeRange = '3d' | '7d' | '14d'

interface DataPoint {
  ts: string
  i: number | null
  v: number | null
  p: number | null
  poa: number | null
}

interface Props {
  analyticsHistory: AnalyticsSnapshot[]
  dailyClassification: DayClassification[]
  rawData: DataPoint[]
}

export function StringChartsClient({ analyticsHistory, dailyClassification, rawData }: Props) {
  const [range, setRange] = useState<TimeRange>('7d')

  const days = range === '3d' ? 3 : range === '7d' ? 7 : 14

  const filteredAnalytics = useMemo(() => {
    if (analyticsHistory.length === 0) return []
    const latest = new Date(analyticsHistory[analyticsHistory.length - 1].ts_local)
    const cutoff = new Date(latest.getTime() - days * 24 * 60 * 60 * 1000)
    return analyticsHistory.filter((s) => new Date(s.ts_local) >= cutoff)
  }, [analyticsHistory, days])

  const filteredDaily = useMemo(() => {
    if (dailyClassification.length === 0) return []
    const latest = new Date(dailyClassification[dailyClassification.length - 1].date)
    const cutoff = new Date(latest.getTime() - days * 24 * 60 * 60 * 1000)
    return dailyClassification.filter((d) => new Date(d.date) >= cutoff)
  }, [dailyClassification, days])

  const filteredRaw = useMemo(() => {
    if (rawData.length === 0) return []
    const latest = new Date(rawData[rawData.length - 1].ts)
    const cutoff = new Date(latest.getTime() - days * 24 * 60 * 60 * 1000)
    return rawData.filter((d) => new Date(d.ts) >= cutoff)
  }, [rawData, days])

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex items-center gap-1">
        {(['3d', '7d', '14d'] as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              range === r
                ? 'bg-gray-700 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {r === '3d' ? '3 dias' : r === '7d' ? '7 dias' : '14 dias'}
          </button>
        ))}
      </div>

      {/* P string vs P esperado */}
      {filteredAnalytics.length >= 2 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-2">P string vs P esperado</h3>
          <ComparisonTimeSeries snapshots={filteredAnalytics} />
        </div>
      )}

      {/* Ratio de rendimiento */}
      {filteredAnalytics.length >= 2 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-2">Ratio de rendimiento</h3>
          <RatioTimeSeries snapshots={filteredAnalytics} />
        </div>
      )}

      {/* Daily classification (module-group P75 reference) */}
      {filteredDaily.length > 0 && (
        <DailyClassificationBar days={filteredDaily} />
      )}

      {/* Raw time series: P+POA overlay, I+V overlay */}
      {filteredRaw.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-2">Serie temporal</h3>
          <RawDualChart data={filteredRaw} />
        </div>
      )}
    </div>
  )
}
