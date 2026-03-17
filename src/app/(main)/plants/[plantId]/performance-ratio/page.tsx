import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getPrDashboard } from '@/features/performance-ratio/services/getPrDashboard'
import { PrKpiCards } from '@/features/performance-ratio/components/PrKpiCards'
import { DailyPrChart } from '@/features/performance-ratio/components/DailyPrChart'
import { InverterPrTable } from '@/features/performance-ratio/components/InverterPrTable'
import { MonthSelector } from '@/features/performance-ratio/components/MonthSelector'
import Link from 'next/link'

export const metadata = { title: 'Performance Ratio | Lucvia' }

interface Props {
  params: Promise<{ plantId: string }>
  searchParams: Promise<{ month?: string }>
}

export default async function PerformanceRatioPage({ params, searchParams }: Props) {
  const { plantId } = await params
  const { month: monthParam } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: plant } = await supabase
    .from('plants')
    .select('id, name')
    .eq('id', plantId)
    .single()

  if (!plant) notFound()

  // Default to current month if none specified
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const month = monthParam ?? defaultMonth

  const dashboard = await getPrDashboard(plantId, month)

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Performance Ratio</h1>
          <p className="text-gray-400 text-sm mt-1">{plant.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector
            availableMonths={dashboard.availableMonths}
            currentMonth={month}
            basePath={`/plants/${plantId}/performance-ratio`}
          />
          <Link
            href={`/plants/${plantId}/ingestion`}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
          >
            Ingestar datos
          </Link>
        </div>
      </div>

      {!dashboard.hasData ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
          <p className="text-gray-400 mb-2">Sin datos de PR para {month}.</p>
          <p className="text-gray-500 text-sm">
            Ingesta los CSVs de GPM y ejecuta el calculo desde{' '}
            <Link href={`/plants/${plantId}/ingestion`} className="text-emerald-400 hover:text-emerald-300">
              Ingestion
            </Link>.
          </p>
        </div>
      ) : (
        <>
          <PrKpiCards kpis={dashboard.kpis} />
          <DailyPrChart
            points={dashboard.dailyPoints}
            guaranteedPrPct={dashboard.kpis.guaranteedPrPct}
          />
          <InverterPrTable inverters={dashboard.inverters} plantId={plantId} />
        </>
      )}
    </div>
  )
}
