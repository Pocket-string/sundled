'use client'

import { useActionState } from 'react'
import { createPlant } from '@/actions/plants'

const initialState = { error: null as string | null }

export function PlantForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await createPlant(formData)
      if (result && 'error' in result) {
        const errorMsg = typeof result.error === 'string'
          ? result.error
          : Object.entries(result.error as Record<string, string[]>).map(([k, v]) => `${k}: ${v.join(', ')}`).join('; ')
        return { error: errorMsg }
      }
      return { error: null }
    },
    initialState
  )

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {state.error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1.5">
            Nombre de la planta *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Ej: Planta Solar Zaldivia"
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="lat" className="block text-sm font-medium text-gray-300 mb-1.5">
              Latitud
            </label>
            <input
              id="lat"
              name="lat"
              type="number"
              step="any"
              placeholder="-23.65"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            />
          </div>
          <div>
            <label htmlFor="lon" className="block text-sm font-medium text-gray-300 mb-1.5">
              Longitud
            </label>
            <input
              id="lon"
              name="lon"
              type="number"
              step="any"
              placeholder="-70.40"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-300 mb-1.5">
              Zona horaria
            </label>
            <select
              id="timezone"
              name="timezone"
              defaultValue="America/Santiago"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            >
              <option value="America/Santiago">America/Santiago (CLT)</option>
              <option value="America/Mexico_City">America/Mexico_City (CST)</option>
              <option value="America/Sao_Paulo">America/Sao_Paulo (BRT)</option>
              <option value="Europe/Madrid">Europe/Madrid (CET)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div>
            <label htmlFor="ct_count" className="block text-sm font-medium text-gray-300 mb-1.5">
              Centros de transformacion
            </label>
            <input
              id="ct_count"
              name="ct_count"
              type="number"
              min="1"
              defaultValue="1"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="module_power_w" className="block text-sm font-medium text-gray-300 mb-1.5">
              Potencia modulo (W)
            </label>
            <input
              id="module_power_w"
              name="module_power_w"
              type="number"
              placeholder="540"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            />
          </div>
          <div>
            <label htmlFor="energy_price" className="block text-sm font-medium text-gray-300 mb-1.5">
              Precio energia
            </label>
            <input
              id="energy_price"
              name="energy_price"
              type="number"
              step="0.01"
              placeholder="0.08"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            />
          </div>
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-300 mb-1.5">
              Moneda
            </label>
            <select
              id="currency"
              name="currency"
              defaultValue="USD"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            >
              <option value="USD">USD</option>
              <option value="CLP">CLP</option>
              <option value="EUR">EUR</option>
              <option value="MXN">MXN</option>
              <option value="BRL">BRL</option>
            </select>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium transition-colors"
      >
        {isPending ? 'Creando...' : 'Crear planta'}
      </button>
    </form>
  )
}
