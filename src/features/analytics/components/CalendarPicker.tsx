'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DAY_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

interface Props {
  dates: string[]          // available dates as YYYY-MM-DD, sorted desc
  currentDate: string | null
  onSelect: (date: string) => void
  disabled?: boolean
}

/** Pad number to 2 digits */
function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** Get all calendar cells (days) for a given month, padded with nulls for alignment */
function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  // Convert to Monday-start: Sun(0)->6, Mon(1)->0, Tue(2)->1, ...
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // Pad to complete last week
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function CalendarPicker({ dates, currentDate, onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Set of available dates for O(1) lookup
  const availableSet = useMemo(() => new Set(dates), [dates])

  // Determine initial display month from currentDate or first available
  const initDate = currentDate ?? dates[0] ?? null
  const [viewYear, setViewYear] = useState(() => initDate ? parseInt(initDate.substring(0, 4)) : 2026)
  const [viewMonth, setViewMonth] = useState(() => initDate ? parseInt(initDate.substring(5, 7)) - 1 : 0)

  // Derive min/max months from available dates
  const { minYear, minMonth, maxYear, maxMonth } = useMemo(() => {
    if (dates.length === 0) return { minYear: 2025, minMonth: 0, maxYear: 2026, maxMonth: 11 }
    const last = dates[dates.length - 1]
    const first = dates[0]
    return {
      minYear: parseInt(last.substring(0, 4)),
      minMonth: parseInt(last.substring(5, 7)) - 1,
      maxYear: parseInt(first.substring(0, 4)),
      maxMonth: parseInt(first.substring(5, 7)) - 1,
    }
  }, [dates])

  const canPrev = viewYear > minYear || (viewYear === minYear && viewMonth > minMonth)
  const canNext = viewYear < maxYear || (viewYear === maxYear && viewMonth < maxMonth)

  const goNext = useCallback(() => {
    if (!canNext) return
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }, [canNext, viewMonth])

  const goPrev = useCallback(() => {
    if (!canPrev) return
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }, [canPrev, viewMonth])

  const days = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // When currentDate changes, jump calendar to that month
  useEffect(() => {
    if (currentDate) {
      setViewYear(parseInt(currentDate.substring(0, 4)))
      setViewMonth(parseInt(currentDate.substring(5, 7)) - 1)
    }
  }, [currentDate])

  // Format display label
  const displayLabel = currentDate
    ? `${parseInt(currentDate.substring(8, 10))} ${MONTH_LABELS[parseInt(currentDate.substring(5, 7)) - 1]?.substring(0, 3)} ${currentDate.substring(0, 4)}`
    : 'Seleccionar'

  // Count available dates in current view month
  const availableInMonth = useMemo(() => {
    const prefix = `${viewYear}-${pad(viewMonth + 1)}`
    return dates.filter(d => d.startsWith(prefix)).length
  }, [dates, viewYear, viewMonth])

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="flex items-center gap-2 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 hover:border-gray-600 focus:ring-emerald-500 focus:border-emerald-500 transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
        <span>{displayLabel}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-3 w-[280px]">
          {/* Month/Year nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canPrev}
              className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-sm font-medium text-white">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0 mb-1">
            {DAY_HEADERS.map(dh => (
              <div key={dh} className="text-center text-[10px] font-medium text-gray-500 py-1">{dh}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0">
            {days.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} className="h-8" />

              const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
              const isAvailable = availableSet.has(dateStr)
              const isSelected = dateStr === currentDate
              const isToday = dateStr === new Date().toISOString().substring(0, 10)

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => { onSelect(dateStr); setOpen(false) }}
                  className={`
                    h-8 w-full rounded-md text-xs font-medium transition-colors
                    ${isSelected
                      ? 'bg-emerald-600 text-white'
                      : isAvailable
                        ? 'text-white hover:bg-gray-700 cursor-pointer'
                        : 'text-gray-600 cursor-default'
                    }
                    ${isToday && !isSelected ? 'ring-1 ring-emerald-500/50' : ''}
                  `}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Footer info */}
          <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] text-gray-500 text-center">
            {availableInMonth} dias con datos en {MONTH_LABELS[viewMonth]?.substring(0, 3)}
          </div>
        </div>
      )}
    </div>
  )
}
