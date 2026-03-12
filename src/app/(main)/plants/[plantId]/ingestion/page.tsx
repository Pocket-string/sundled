import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ManualSyncForm } from '@/features/ingestion/components/ManualSyncForm'

export const metadata = { title: 'Ingestion | Lucvia' }

interface Props {
  params: Promise<{ plantId: string }>
}

export default async function IngestionPage({ params }: Props) {
  const { plantId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: plant } = await supabase
    .from('plants')
    .select('id, name, ct_count, onboarding_status')
    .eq('id', plantId)
    .single()

  if (!plant) notFound()

  const isReady = plant.onboarding_status === 'ready_to_sync' || plant.onboarding_status === 'active'

  // Get recent jobs
  const { data: jobs } = await supabase
    .from('ingestion_jobs')
    .select('id, status, date_start, date_end, records_loaded, records_expected, error_message, started_at, completed_at, created_at')
    .eq('plant_id', plantId)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Ingestion de datos</h1>
        <p className="text-gray-400">{plant.name}</p>
      </div>

      <ManualSyncForm
        plantId={plantId}
        ctCount={plant.ct_count}
        isReady={isReady}
      />

      {/* Job History */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Historial de sincronizaciones</h3>

        {!jobs || jobs.length === 0 ? (
          <p className="text-sm text-gray-500">Sin sincronizaciones registradas.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map(job => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={job.status} />
                  <div>
                    <p className="text-sm text-white">
                      {job.date_start}
                      {job.date_end !== job.date_start ? ` a ${job.date_end}` : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {job.records_loaded} registros
                      {job.records_expected ? ` / ${job.records_expected} esperados` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {job.completed_at
                      ? new Date(job.completed_at).toLocaleString('es-CL')
                      : job.started_at
                      ? 'En progreso...'
                      : 'Pendiente'}
                  </p>
                  {job.error_message && (
                    <p className="text-xs text-red-400 max-w-xs truncate" title={job.error_message}>
                      {job.error_message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: 'bg-emerald-500/20 text-emerald-400',
    partial: 'bg-yellow-500/20 text-yellow-400',
    error: 'bg-red-500/20 text-red-400',
    running: 'bg-blue-500/20 text-blue-400',
    pending: 'bg-gray-500/20 text-gray-400',
    cancelled: 'bg-gray-500/20 text-gray-500',
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  )
}
