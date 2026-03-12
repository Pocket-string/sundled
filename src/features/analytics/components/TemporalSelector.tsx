'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import type { AvailableTimestamp } from '../types'
import { CalendarPicker } from './CalendarPicker'

interface Props {
  dates: string[]
  timestamps: AvailableTimestamp[]
  currentDate: string | null
  currentTs: string | null
  basePath: string
  /** Hide timestamp selector (for daily window mode) */
  hiddenTimestamp?: boolean
}

export function TemporalSelector({ dates, timestamps, currentDate, currentTs, basePath, hiddenTimestamp }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleDateChange = (date: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', date)
    params.delete('ts')
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`)
    })
  }

  const handleTsChange = (ts: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (currentDate) params.set('date', currentDate)
    params.set('ts', ts)
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`)
    })
  }

  const handleMaxPoa = () => {
    if (!timestamps.length) return
    const best = timestamps.reduce((a, b) => (b.avgPoa > a.avgPoa ? b : a))
    handleTsChange(best.ts)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Calendar date picker */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Fecha</label>
        <CalendarPicker
          dates={dates}
          currentDate={currentDate}
          onSelect={handleDateChange}
          disabled={isPending}
        />
      </div>

      {/* Timestamp selector (hidden in daily window mode) */}
      {!hiddenTimestamp && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Timestamp</label>
            <select
              value={currentTs ?? ''}
              onChange={(e) => handleTsChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-emerald-500 focus:border-emerald-500"
              disabled={isPending || timestamps.length === 0}
            >
              {timestamps.length === 0 && <option value="">—</option>}
              {timestamps.map((t) => (
                <option key={t.ts} value={t.ts}>
                  {t.ts.substring(11, 16)} — POA {t.avgPoa} W/m² ({t.stringCount} strings)
                </option>
              ))}
            </select>
          </div>

          {/* Max POA action */}
          <button
            onClick={handleMaxPoa}
            disabled={isPending || timestamps.length === 0}
            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 text-xs font-medium hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
          >
            Max POA
          </button>
        </>
      )}

      {isPending && (
        <span className="text-xs text-gray-500 animate-pulse">Cargando...</span>
      )}
    </div>
  )
}
