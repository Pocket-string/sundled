'use client'

import { useState } from 'react'

const TOOL_LABELS: Record<string, string> = {
  queryPlantStatus: 'Estado de planta',
  queryTopUnderperformers: 'Top bajo rendimiento',
  compareEntities: 'Comparacion',
  queryRecentDetail: 'Detalle reciente',
}

interface Props {
  toolName: string
  state: string
  input?: Record<string, unknown>
}

export function ToolCallCard({ toolName, state, input }: Props) {
  const [expanded, setExpanded] = useState(false)
  const label = TOOL_LABELS[toolName] ?? toolName
  const isLoading = state !== 'output-available'

  return (
    <div className="my-1.5 rounded-lg border border-gray-700/40 bg-gray-800/40 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {isLoading ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        ) : (
          <svg className="h-3 w-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        <span className="font-medium text-gray-300">
          {isLoading ? `Consultando ${label}...` : `Consulte: ${label}`}
        </span>
        <svg
          className={`ml-auto h-3 w-3 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && input && (
        <div className="border-t border-gray-700/30 px-3 py-2 text-gray-500">
          <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(input, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
