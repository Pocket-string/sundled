import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { StringTimeSeries } from '@/features/dashboard/components/StringTimeSeries'
import Link from 'next/link'

export const metadata = { title: 'String Detail | Lucvia' }

interface Props {
  params: Promise<{ plantId: string; stringId: string }>
}

export default async function StringDetailPage({ params }: Props) {
  const { plantId, stringId } = await params
  const decodedStringId = decodeURIComponent(stringId)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: plant } = await supabase
    .from('plants')
    .select('id, name')
    .eq('id', plantId)
    .single()

  if (!plant) notFound()

  // Get tracker info
  const { data: tracker } = await supabase
    .from('dim_trackers')
    .select('*')
    .eq('plant_id', plantId)
    .eq('string_id', decodedStringId)
    .single()

  // Get time series (last 7 days)
  const { data: timeSeries } = await supabase
    .from('fact_string')
    .select('ts_local, i_string, v_string, p_string, poa, t_mod')
    .eq('plant_id', plantId)
    .eq('string_id', decodedStringId)
    .order('ts_local', { ascending: true })
    .limit(336) // 48 intervals/day * 7 days

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <Link
          href={`/plants/${plantId}/dashboard`}
          className="text-gray-500 hover:text-gray-300 text-sm mb-2 inline-block"
        >
          &larr; Volver al dashboard
        </Link>
        <h1 className="text-2xl font-bold text-white">{decodedStringId}</h1>
        <p className="text-gray-400 text-sm mt-1">{plant.name}</p>
      </div>

      {/* Tracker info */}
      {tracker && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-gray-500">CT</dt>
              <dd className="text-gray-300">{tracker.ct_id}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Inversor</dt>
              <dd className="text-gray-300">{tracker.inverter_id}</dd>
            </div>
            <div>
              <dt className="text-gray-500">DC In</dt>
              <dd className="text-gray-300">{tracker.dc_in}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Modulo</dt>
              <dd className="text-gray-300">{tracker.module ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Tracker</dt>
              <dd className="text-gray-300">{tracker.tracker_id}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Peer Group</dt>
              <dd className="text-gray-300">{tracker.peer_group ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">SVG ID</dt>
              <dd className="text-gray-300">{tracker.svg_id}</dd>
            </div>
            <div>
              <dt className="text-gray-500">MPPT Key</dt>
              <dd className="text-gray-300">{tracker.inverter_dc_key}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Time Series Chart */}
      {timeSeries && timeSeries.length > 0 ? (
        <StringTimeSeries
          data={timeSeries.map(row => ({
            ts: row.ts_local,
            i: row.i_string,
            v: row.v_string,
            p: row.p_string,
            poa: row.poa,
          }))}
        />
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-500">
          Sin datos de serie temporal para este string.
        </div>
      )}

      {/* Raw Data Table */}
      {timeSeries && timeSeries.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Datos recientes ({timeSeries.length} registros)</h3>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-2 font-medium">Timestamp</th>
                  <th className="px-4 py-2 font-medium text-right">I (A)</th>
                  <th className="px-4 py-2 font-medium text-right">V (V)</th>
                  <th className="px-4 py-2 font-medium text-right">P (W)</th>
                  <th className="px-4 py-2 font-medium text-right">POA</th>
                  <th className="px-4 py-2 font-medium text-right">T mod</th>
                </tr>
              </thead>
              <tbody>
                {timeSeries.slice(-48).reverse().map((row, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="px-4 py-2 text-gray-300">{row.ts_local}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{row.i_string?.toFixed(2) ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{row.v_string?.toFixed(1) ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{row.p_string?.toFixed(0) ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{row.poa?.toFixed(0) ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{row.t_mod?.toFixed(1) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
