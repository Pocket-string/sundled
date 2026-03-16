'use client'

import { useAgentStore } from '../store/useAgentStore'

export function AgentFAB() {
  const { isOpen, toggle } = useAgentStore()

  if (isOpen) return null

  return (
    <button
      onClick={toggle}
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-500 hover:shadow-xl hover:shadow-emerald-900/40 active:scale-95"
      aria-label="Abrir asistente LUCIA"
    >
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    </button>
  )
}
