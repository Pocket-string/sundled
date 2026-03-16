'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

interface FormState {
  name: string
  email: string
  company: string
  message: string
}

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'

const INITIAL_FORM: FormState = {
  name: '',
  email: '',
  company: '',
  message: '',
}

export function ContactModal({ isOpen, onClose }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const firstInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 50)
    } else {
      // Reset form when closed
      setForm(INITIAL_FORM)
      setStatus('idle')
      setErrorMessage('')
    }
  }, [isOpen])

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data: unknown = await response.json()

      if (!response.ok) {
        const msg =
          typeof data === 'object' &&
          data !== null &&
          'error' in data &&
          typeof (data as Record<string, unknown>).error === 'string'
            ? (data as { error: string }).error
            : 'Ocurrió un error al enviar el mensaje.'
        setErrorMessage(msg)
        setStatus('error')
        return
      }

      setStatus('success')
    } catch {
      setErrorMessage('Error de conexión. Por favor intenta de nuevo.')
      setStatus('error')
    }
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal panel */}
      <div
        ref={modalRef}
        className="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-800">
          <div>
            <h2
              id="contact-modal-title"
              className="text-lg font-semibold text-white"
            >
              Habla con nuestro equipo
            </h2>
            <p className="mt-0.5 text-sm text-gray-400">
              Te respondemos en menos de 24 horas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar formulario de contacto"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {status === 'success' ? (
            <SuccessState onClose={onClose} />
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">
                {/* Nombre */}
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block mb-1.5 text-sm font-medium text-gray-300"
                  >
                    Nombre <span className="text-emerald-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={firstInputRef}
                    id="contact-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={form.name}
                    onChange={handleChange}
                    disabled={status === 'loading'}
                    placeholder="Juan García"
                    className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent disabled:opacity-50 transition"
                  />
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="contact-email"
                    className="block mb-1.5 text-sm font-medium text-gray-300"
                  >
                    Email <span className="text-emerald-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    disabled={status === 'loading'}
                    placeholder="juan@empresa.com"
                    className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent disabled:opacity-50 transition"
                  />
                </div>

                {/* Empresa */}
                <div>
                  <label
                    htmlFor="contact-company"
                    className="block mb-1.5 text-sm font-medium text-gray-300"
                  >
                    Empresa <span className="text-emerald-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="contact-company"
                    name="company"
                    type="text"
                    autoComplete="organization"
                    required
                    value={form.company}
                    onChange={handleChange}
                    disabled={status === 'loading'}
                    placeholder="Solar S.A."
                    className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent disabled:opacity-50 transition"
                  />
                </div>

                {/* Mensaje */}
                <div>
                  <label
                    htmlFor="contact-message"
                    className="block mb-1.5 text-sm font-medium text-gray-300"
                  >
                    Mensaje{' '}
                    <span className="text-gray-500 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={3}
                    value={form.message}
                    onChange={handleChange}
                    disabled={status === 'loading'}
                    placeholder="Cuéntanos sobre tu instalación o proyecto..."
                    className="w-full px-3.5 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent disabled:opacity-50 transition resize-none"
                  />
                </div>

                {/* Error message */}
                {status === 'error' && errorMessage && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 px-3.5 py-3 bg-red-950/50 border border-red-800/60 rounded-lg text-sm text-red-400"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {errorMessage}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  {status === 'loading' ? (
                    <>
                      <LoadingSpinner />
                      Enviando...
                    </>
                  ) : (
                    'Enviar mensaje'
                  )}
                </button>

                <p className="text-center text-xs text-gray-500">
                  Al enviar aceptas que nos pongamos en contacto contigo.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Sub-components ---

function SuccessState({ onClose }: { onClose: () => void }) {
  return (
    <div className="py-6 flex flex-col items-center text-center gap-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-950 border border-emerald-800">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-400"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div>
        <h3 className="text-white font-semibold text-base">Mensaje enviado</h3>
        <p className="mt-1 text-sm text-gray-400">
          Nuestro equipo te contactará en menos de 24 horas.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        Cerrar
      </button>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
