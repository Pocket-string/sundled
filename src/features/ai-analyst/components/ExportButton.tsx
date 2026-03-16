'use client'

import { useState } from 'react'
import type { UIMessage } from 'ai'
import { messageToMarkdown, copyToClipboard } from '../utils/export-markdown'

interface Props {
  message: UIMessage
}

export function ExportButton({ message }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const md = messageToMarkdown(message)
    const ok = await copyToClipboard(md)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-gray-500 transition-colors hover:bg-gray-700/50 hover:text-gray-300"
      title="Copiar respuesta"
    >
      {copied ? (
        <>
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copiado
        </>
      ) : (
        <>
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copiar
        </>
      )}
    </button>
  )
}
