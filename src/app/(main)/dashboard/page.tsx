import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BentoGrid } from '@/components/ui/BentoGrid'
import { BentoCard } from '@/components/ui/BentoCard'
import { LucviaLogo } from '@/components/LucviaLogo'

export const metadata = {
  title: 'Dashboard | Lucvia',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: plants } = await supabase
    .from('plants')
    .select('id, name, string_count, last_sync_at, last_sync_status, onboarding_status')
    .order('created_at', { ascending: false })

  const hasPlants = plants && plants.length > 0

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Resumen de tus plantas fotovoltaicas</p>
      </div>

      {!hasPlants ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6">
            <LucviaLogo className="w-8 h-8" variant="emerald" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Crea tu primera planta</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Agrega una planta fotovoltaica para comenzar a monitorear el rendimiento de tus strings.
          </p>
          <a
            href="/plants/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Crear planta
          </a>
        </div>
      ) : (
        <BentoGrid cols={4}>
          {/* Hero welcome card */}
          <BentoCard span="wide" padding="lg" className="col-span-1 md:col-span-2 lg:col-span-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Bienvenido a Lucvia</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {plants.length === 1
                    ? 'Tienes 1 planta registrada'
                    : `Tienes ${plants.length} plantas registradas`}
                </p>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <LucviaLogo className="w-8 h-8" variant="emerald" />
                <span className="text-3xl font-bold">{plants.length}</span>
              </div>
            </div>
          </BentoCard>

          {/* Plant cards */}
          {plants.map((plant) => (
            <a
              key={plant.id}
              href={`/plants/${plant.id}`}
              className="block rounded-2xl border border-gray-800/50 bg-gray-900/80 backdrop-blur-sm p-5 hover:border-emerald-500/50 transition-colors col-span-1 md:col-span-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white truncate">{plant.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {plant.string_count} strings
                    {plant.last_sync_at
                      ? ` · Ultima sync: ${new Date(plant.last_sync_at).toLocaleDateString('es-CL')}`
                      : ' · Sin sincronizar'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${
                      plant.onboarding_status === 'active'
                        ? 'bg-emerald-400'
                        : plant.onboarding_status === 'ready_to_sync'
                          ? 'bg-yellow-400'
                          : 'bg-gray-500'
                    }`}
                  />
                  <span className="text-sm text-gray-400 capitalize">{plant.onboarding_status}</span>
                </div>
              </div>
            </a>
          ))}

          {/* Add plant CTA */}
          <a
            href="/plants/new"
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-700 bg-transparent p-5 hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-colors col-span-1 md:col-span-2"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-400">Agregar planta</span>
          </a>
        </BentoGrid>
      )}
    </div>
  )
}
