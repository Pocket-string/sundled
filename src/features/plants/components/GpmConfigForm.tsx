'use client'

import { useState } from 'react'
import { saveGpmIntegration } from '@/actions/integrations'

interface Props {
  plantId: string
  hasIntegration: boolean
  queryIds: Record<string, string> | null
}

export function GpmConfigForm({ plantId, hasIntegration, queryIds }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('saving')
    setMessage('')

    const formData = new FormData(e.currentTarget)
    const result = await saveGpmIntegration(plantId, formData)

    if (result && 'error' in result) {
      setStatus('error')
      const err = result.error
      setMessage(typeof err === 'string' ? err : Object.entries(err as Record<string, string[]>).map(([k, v]) => `${k}: ${v.join(', ')}`).join('; '))
    } else {
      setStatus('success')
      setMessage('Integracion GPM guardada correctamente')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Integracion GPM</h3>
        {hasIntegration && (
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">Configurado</span>
        )}
      </div>
      <p className="text-xs text-gray-500">Credenciales del portal GreenPowerMonitor y Query IDs para descargar datos.</p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="username" className="block text-xs font-medium text-gray-400 mb-1">Usuario GPM</label>
          <input id="username" name="username" type="text" required
            placeholder="usuario@email.com"
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
        </div>
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-gray-400 mb-1">Password GPM</label>
          <input id="password" name="password" type="password" required
            placeholder="••••••••"
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
        </div>
      </div>

      <div className="border-t border-gray-800 pt-4">
        <p className="text-xs font-medium text-gray-400 mb-3">Query IDs (numeros del portal GPM)</p>
        <div className="grid grid-cols-3 gap-3">
          <QueryInput name="query_I_CT1" label="I Strings CT1" required defaultValue={queryIds?.I_CT1} />
          <QueryInput name="query_I_CT2" label="I Strings CT2" defaultValue={queryIds?.I_CT2} />
          <QueryInput name="query_I_CT3" label="I Strings CT3" defaultValue={queryIds?.I_CT3} />
          <QueryInput name="query_V_CT1" label="V String CT1" required defaultValue={queryIds?.V_CT1} />
          <QueryInput name="query_V_CT2" label="V String CT2" defaultValue={queryIds?.V_CT2} />
          <QueryInput name="query_V_CT3" label="V String CT3" defaultValue={queryIds?.V_CT3} />
          <QueryInput name="query_POA" label="POA" required defaultValue={queryIds?.POA} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white text-sm font-medium transition-colors"
        >
          {status === 'saving' ? 'Guardando...' : 'Guardar integracion'}
        </button>
        {message && (
          <p className={`text-sm ${status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{message}</p>
        )}
      </div>
    </form>
  )
}

function QueryInput({ name, label, required, defaultValue }: { name: string; label: string; required?: boolean; defaultValue?: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs text-gray-500 mb-1">
        {label}{required && ' *'}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        required={required}
        defaultValue={defaultValue ?? ''}
        placeholder="402244"
        className="w-full px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
      />
    </div>
  )
}
