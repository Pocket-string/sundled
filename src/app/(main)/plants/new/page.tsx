import { PlantForm } from '@/features/plants/components/PlantForm'

export const metadata = { title: 'Nueva Planta | Lucvia' }

export default function NewPlantPage() {
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Crear planta</h1>
      <p className="text-gray-400 mb-8">Completa los datos de tu planta fotovoltaica.</p>
      <PlantForm />
    </div>
  )
}
