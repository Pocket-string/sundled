'use client'

import { useState, useEffect } from 'react'

interface Event {
  id: number
  start_ts: string
  end_ts: string
  inverter_id: string | null
  liability: string
  description: string | null
}

interface Props {
  plantId: string
  month: string
}

/**
 * Read-only display of unavailability events for a given month.
 * Explains how PR modified and availability modified are computed.
 */
export function UnavailabilityEventsReadonly({ plantId, month }: Props) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams({ plantId, month })
    fetch(`/api/pr-unavailability?${params}`)
      .then(res => res.json())
      .then(data => setEvents(data.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [plantId, month])

  const contractorEvents = events.filter(e => e.liability === 'contractor')
  const operatorEvents = events.filter(e => e.liability === 'operator')

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Eventos de indisponibilidad</h3>
        <p className="text-xs text-gray-500 mt-1">
          Define como se calcula el PR Modificado y la Disponibilidad. Los eventos de <span className="text-blue-400">contratista</span> reducen
          la disponibilidad clean. Los eventos de <span className="text-yellow-400">operador</span> se excluyen del calculo modificado.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : events.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-800/50 rounded-lg p-4">
          Sin eventos de indisponibilidad registrados para {month}.
          Toda indisponibilidad detectada se clasifica como responsabilidad del contratista por defecto.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex gap-4 text-xs">
            <span className="text-blue-400">
              {contractorEvents.length} evento{contractorEvents.length !== 1 ? 's' : ''} contratista
            </span>
            <span className="text-yellow-400">
              {operatorEvents.length} evento{operatorEvents.length !== 1 ? 's' : ''} operador
            </span>
          </div>

          {/* Events list */}
          <div className="space-y-1.5">
            {events.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-800/50 text-sm">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                  ev.liability === 'operator'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {ev.liability === 'operator' ? 'Operador' : 'Contratista'}
                </span>
                <span className="text-gray-400 text-xs whitespace-nowrap">
                  {ev.start_ts.slice(5, 16)} — {ev.end_ts.slice(5, 16)}
                </span>
                <span className="text-gray-300 text-xs">
                  {ev.inverter_id ?? 'Planta completa'}
                </span>
                {ev.description && (
                  <span className="text-gray-500 text-xs truncate" title={ev.description}>
                    {ev.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
