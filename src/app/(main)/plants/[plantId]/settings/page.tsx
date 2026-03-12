import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PlantSettingsClient } from '@/features/plants/components/PlantSettingsClient'

export const metadata = { title: 'Configuracion | Lucvia' }

interface Props {
  params: Promise<{ plantId: string }>
}

export default async function PlantSettingsPage({ params }: Props) {
  const { plantId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: plant } = await supabase
    .from('plants')
    .select('*')
    .eq('id', plantId)
    .single()

  if (!plant) notFound()

  // Get tracker, layout counts and integration
  const [{ count: trackerCount }, { count: layoutCount }, { data: integration }] = await Promise.all([
    supabase.from('dim_trackers').select('*', { count: 'exact', head: true }).eq('plant_id', plantId),
    supabase.from('svg_layout').select('*', { count: 'exact', head: true }).eq('plant_id', plantId),
    supabase.from('plant_integrations').select('query_ids_json').eq('plant_id', plantId).single(),
  ])

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Configuracion</h1>
        <p className="text-gray-400">{plant.name}</p>
      </div>

      <PlantSettingsClient
        plant={plant}
        trackerCount={trackerCount ?? 0}
        layoutCount={layoutCount ?? 0}
        hasIntegration={!!integration}
        queryIds={integration?.query_ids_json as Record<string, string> | null}
      />
    </div>
  )
}
