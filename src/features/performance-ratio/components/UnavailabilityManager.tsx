'use client'

import { useState, useEffect, useCallback } from 'react'

interface UnavailabilityEvent {
  id: number
  plant_id: string
  start_ts: string
  end_ts: string
  inverter_id: string | null
  liability: string
  description: string | null
  imported_at: string
}

interface Props {
  plantId: string
  month?: string
}

export function UnavailabilityManager({ plantId, month }: Props) {
  const [events, setEvents] = useState<UnavailabilityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ plantId })
      if (month) params.set('month', month)
      const res = await fetch(`/api/pr-unavailability?${params}`)
      const data = await res.json()
      if (res.ok) {
        setEvents(data.events)
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch {
      setMessage({ type: 'error', text: 'Error loading events' })
    } finally {
      setLoading(false)
    }
  }, [plantId, month])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploading(true)
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const file = formData.get('csvFile') as File | null

    if (!file) {
      setMessage({ type: 'error', text: 'Selecciona un archivo CSV' })
      setUploading(false)
      return
    }

    try {
      const csv = await file.text()
      const res = await fetch('/api/pr-unavailability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantId, csv }),
      })
      const data = await res.json()

      if (res.ok) {
        const warnings = data.parseErrors?.length
          ? ` (${data.parseErrors.length} warnings)`
          : ''
        setMessage({ type: 'success', text: `${data.upserted} eventos importados${warnings}` })
        fetchEvents()
        // Reset form
        ;(e.target as HTMLFormElement).reset()
      } else {
        const errDetail = data.parseErrors?.join('\n') ?? ''
        setMessage({ type: 'error', text: `${data.error}${errDetail ? '\n' + errDetail : ''}` })
      }
    } catch {
      setMessage({ type: 'error', text: 'Error uploading file' })
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch('/api/pr-unavailability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setEvents(prev => prev.filter(ev => ev.id !== id))
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error })
      }
    } catch {
      setMessage({ type: 'error', text: 'Error deleting event' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <form onSubmit={handleUpload} className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Importar indisponibilidades</h3>
          <p className="text-xs text-gray-500 mt-1">
            CSV con columnas: fecha_inicio;fecha_fin;inverter_id;liability;descripcion
          </p>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="csvFile" className="block text-xs text-gray-500 mb-1">
              Archivo CSV
            </label>
            <input
              id="csvFile"
              name="csvFile"
              type="file"
              accept=".csv,.txt"
              required
              className="w-full text-xs text-gray-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-800 file:text-gray-300 file:text-xs file:font-medium hover:file:bg-gray-700 file:cursor-pointer"
            />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            {uploading ? 'Importando...' : 'Importar'}
          </button>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${
            message.type === 'error'
              ? 'bg-red-500/10 border border-red-500/20 text-red-400'
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
          }`}>
            {message.text}
          </div>
        )}
      </form>

      {/* Events table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">
          Eventos de indisponibilidad
          {month && <span className="text-gray-500 font-normal"> ({month})</span>}
        </h3>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-500">Sin eventos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="pb-2 text-xs font-medium text-gray-500">Inicio</th>
                  <th className="pb-2 text-xs font-medium text-gray-500">Fin</th>
                  <th className="pb-2 text-xs font-medium text-gray-500">Inversor</th>
                  <th className="pb-2 text-xs font-medium text-gray-500">Responsable</th>
                  <th className="pb-2 text-xs font-medium text-gray-500">Descripcion</th>
                  <th className="pb-2 text-xs font-medium text-gray-500 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">
                      {ev.start_ts}
                    </td>
                    <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">
                      {ev.end_ts}
                    </td>
                    <td className="py-2 pr-3 text-gray-300">
                      {ev.inverter_id ?? 'Planta completa'}
                    </td>
                    <td className="py-2 pr-3">
                      <LiabilityBadge liability={ev.liability} />
                    </td>
                    <td className="py-2 pr-3 text-gray-400 max-w-xs truncate" title={ev.description ?? ''}>
                      {ev.description ?? '-'}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        title="Eliminar evento"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function LiabilityBadge({ liability }: { liability: string }) {
  const isOperator = liability === 'operator'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      isOperator
        ? 'bg-yellow-500/20 text-yellow-400'
        : 'bg-blue-500/20 text-blue-400'
    }`}>
      {isOperator ? 'Operador' : 'Contratista'}
    </span>
  )
}
