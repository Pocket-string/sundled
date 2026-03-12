'use client'

import { useState, useRef } from 'react'

interface FileUploadProps {
  label: string
  accept: string
  description: string
  onUpload: (formData: FormData) => Promise<{ success?: boolean; error?: string; count?: number }>
}

export function FileUpload({ label, accept, description, onUpload }: FileUploadProps) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const file = formData.get('file') as File

    if (!file || file.size === 0) {
      setStatus('error')
      setMessage('Selecciona un archivo')
      return
    }

    setStatus('uploading')
    setMessage('')

    const result = await onUpload(formData)

    if (result.error) {
      setStatus('error')
      setMessage(result.error)
    } else {
      setStatus('success')
      setMessage(`${result.count} registros cargados correctamente`)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="text-sm font-semibold text-white mb-1">{label}</h3>
      <p className="text-xs text-gray-500 mb-4">{description}</p>

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept={accept}
          className="flex-1 text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-800 file:text-gray-300 file:font-medium hover:file:bg-gray-700 file:cursor-pointer"
        />
        <button
          type="submit"
          disabled={status === 'uploading'}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white text-sm font-medium transition-colors"
        >
          {status === 'uploading' ? 'Subiendo...' : 'Subir'}
        </button>
      </div>

      {message && (
        <p className={`mt-3 text-sm ${status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
          {message}
        </p>
      )}
    </form>
  )
}
