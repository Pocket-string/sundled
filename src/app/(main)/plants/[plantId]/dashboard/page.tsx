import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getPlantDashboard } from '@/features/dashboard/services/getPlantDashboard'
import Link from 'next/link'

export const metadata = { title: 'Plant Dashboard | Lucvia' }

interface Props {
  params: Promise<{ plantId: string }>
}

export default async function PlantDashboardPage({ params }: Props) {
  const { plantId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: plant } = await supabase
    .from('plants')
    .select('id, name, onboarding_status')
    .eq('id', plantId)
    .single()

  if (!plant) notFound()

  const dashboard = await getPlantDashboard(plantId)

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{plant.name}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {dashboard.lastTimestamp
              ? `Ultimo dato: ${dashboard.lastTimestamp}`
              : 'Sin datos de sincronizacion'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/plants/${plantId}/heatmap`}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
          >
            Heatmap
          </Link>
          <Link
            href={`/plants/${plantId}/ingestion`}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
          >
            Sincronizar
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Strings configurados" value={dashboard.totalStrings.toString()} />
        <KpiCard label="Strings con dato" value={dashboard.stringsWithData.toString()} />
        <KpiCard
          label="Bajo rendimiento"
          value={dashboard.stringsUnderThreshold.toString()}
          alert={dashboard.stringsUnderThreshold > 0}
        />
        <KpiCard
          label="POA promedio"
          value={dashboard.avgPoa !== null ? `${dashboard.avgPoa.toFixed(0)} W/m2` : '—'}
        />
      </div>

      {/* Strings Table */}
      {dashboard.readings.length > 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">String ID</th>
                  <th className="px-4 py-3 font-medium">Inversor</th>
                  <th className="px-4 py-3 font-medium text-right">I (A)</th>
                  <th className="px-4 py-3 font-medium text-right">V (V)</th>
                  <th className="px-4 py-3 font-medium text-right">P (W)</th>
                  <th className="px-4 py-3 font-medium text-right">POA</th>
                  <th className="px-4 py-3 font-medium text-right">Ratio</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.readings
                  .sort((a, b) => (a.underperf_ratio ?? 999) - (b.underperf_ratio ?? 999))
                  .map(r => (
                    <tr key={r.string_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-2.5">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                          r.status === 'green' ? 'bg-emerald-400' :
                          r.status === 'blue' ? 'bg-cyan-400' :
                          r.status === 'orange' ? 'bg-orange-400' :
                          r.status === 'red' ? 'bg-red-400' :
                          'bg-gray-600'
                        }`} />
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/plants/${plantId}/strings/${encodeURIComponent(r.string_id)}`}
                          className="text-white hover:text-emerald-400 transition-colors"
                        >
                          {r.string_id}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">{r.inverter_id ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{r.i_string?.toFixed(2) ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{r.v_string?.toFixed(1) ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{r.p_string?.toFixed(0) ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{r.poa?.toFixed(0) ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`${
                          r.status === 'green' ? 'text-emerald-400' :
                          r.status === 'blue' ? 'text-cyan-400' :
                          r.status === 'orange' ? 'text-orange-400' :
                          r.status === 'red' ? 'text-red-400' :
                          'text-gray-500'
                        }`}>
                          {r.underperf_ratio !== null ? `${(r.underperf_ratio * 100).toFixed(1)}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
          <p className="text-gray-400">Sin datos de strings para mostrar.</p>
          <Link
            href={`/plants/${plantId}/ingestion`}
            className="inline-block mt-4 text-emerald-400 hover:text-emerald-300 text-sm"
          >
            Ir a sincronizacion
          </Link>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? 'text-red-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}
