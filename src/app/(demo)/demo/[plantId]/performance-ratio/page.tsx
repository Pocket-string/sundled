import { getPrDashboard } from '@/features/performance-ratio/services/getPrDashboard'
import { PrKpiCards } from '@/features/performance-ratio/components/PrKpiCards'
import { DailyPrChart } from '@/features/performance-ratio/components/DailyPrChart'
import { InverterPrTable } from '@/features/performance-ratio/components/InverterPrTable'
import { MonthSelector } from '@/features/performance-ratio/components/MonthSelector'

export const metadata = { title: 'Performance Ratio Demo | Lucvia' }

interface Props {
  params: Promise<{ plantId: string }>
  searchParams: Promise<{ month?: string }>
}

export default async function DemoPerformanceRatioPage({ params, searchParams }: Props) {
  const { plantId } = await params
  const { month: monthParam } = await searchParams

  const defaultMonth = '2025-05'
  const month = monthParam ?? defaultMonth

  const dashboard = await getPrDashboard(plantId, month)

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Performance Ratio</h1>
          <p className="text-gray-400 text-sm mt-1">Demo</p>
        </div>
        <MonthSelector
          availableMonths={dashboard.availableMonths}
          currentMonth={month}
          basePath={`/demo/${plantId}/performance-ratio`}
        />
      </div>

      {!dashboard.hasData ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
          <p className="text-gray-400">Sin datos de PR para {month}.</p>
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
