'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  availableMonths: string[]
  currentMonth: string
  basePath: string
}

export function MonthSelector({ availableMonths, currentMonth, basePath }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', e.target.value)
    router.push(`${basePath}?${params.toString()}`)
  }

  return (
    <select
      value={currentMonth}
      onChange={handleChange}
      className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
    >
      {availableMonths.map(m => (
        <option key={m} value={m}>
          {formatMonth(m)}
        </option>
      ))}
      {!availableMonths.includes(currentMonth) && (
        <option value={currentMonth}>{formatMonth(currentMonth)}</option>
      )}
    </select>
  )
}

function formatMonth(m: string): string {
  const [year, month] = m.split('-')
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${names[parseInt(month) - 1]} ${year}`
}
