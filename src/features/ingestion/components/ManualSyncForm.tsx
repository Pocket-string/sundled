'use client'

import { useState } from 'react'
import { runManualSync } from '@/actions/ingestion'

interface Props {
  plantId: string
  ctCount: number
  isReady: boolean
}

export function ManualSyncForm({ plantId, ctCount, isReady }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [recordCount, setRecordCount] = useState(0)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('running')
    setMessage('Procesando ETL...')
    setRecordCount(0)

    const formData = new FormData(e.currentTarget)
    const result = await runManualSync(plantId, formData)

    if ('error' in result && result.error) {
      setStatus('error')
      setMessage(result.error)
    } else if ('success' in result) {
      setStatus('success')
      setRecordCount(result.count ?? 0)
      setMessage(`Sincronizacion completada: ${result.count} registros cargados`)
    }
  }

  if (!isReady) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
        <p className="text-gray-400 text-sm">Completa el onboarding de la planta para habilitar la sincronizacion.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-white">Sincronizacion manual</h3>
      <p className="text-xs text-gray-500">
        Sube los archivos CSV descargados del portal GPM para un dia especifico.
      </p>

      <div>
        <label htmlFor="date" className="block text-xs font-medium text-gray-400 mb-1">Fecha</label>
        <input
          id="date"
          name="date"
          type="date"
          required
          className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
        />
      </div>

      <div className="border-t border-gray-800 pt-4 space-y-3">
        <p className="text-xs font-medium text-gray-400">Archivos SCADA por CT</p>
        {Array.from({ length: ctCount }, (_, i) => i + 1).map(ct => (
          <div key={ct} className="grid grid-cols-2 gap-3">
            <FileInput name={`i_ct${ct}`} label={`I_Strings_CT${ct}.csv`} required={ct === 1} />
            <FileInput name={`v_ct${ct}`} label={`V_String_CT${ct}.csv`} required={ct === 1} />
          </div>
        ))}
      </div>

      <div className="border-t border-gray-800 pt-4">
        <FileInput name="poa" label="POA.csv" required />
      </div>

      <button
        type="submit"
        disabled={status === 'running'}
        className="w-full px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white text-sm font-medium transition-colors"
      >
        {status === 'running' ? 'Procesando...' : 'Ejecutar sincronizacion'}
      </button>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          status === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
          status === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
          'bg-gray-800 text-gray-400'
        }`}>
          {message}
          {status === 'success' && recordCount > 0 && (
            <p className="text-xs mt-1 text-gray-500">{recordCount} registros en fact_string</p>
          )}
        </div>
      )}
    </form>
  )
}

function FileInput({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs text-gray-500 mb-1">
        {label}{required && ' *'}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        accept=".csv"
        required={required}
        className="w-full text-xs text-gray-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-800 file:text-gray-300 file:text-xs file:font-medium hover:file:bg-gray-700 file:cursor-pointer"
      />
    </div>
  )
}
