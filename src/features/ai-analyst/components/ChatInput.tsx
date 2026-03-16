'use client'

import { useRef, type FormEvent, type KeyboardEvent } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isLoading: boolean
  maxLength?: number
}

export function ChatInput({ value, onChange, onSubmit, isLoading, maxLength = 1500 }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim() || isLoading) return
    onSubmit()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!value.trim() || isLoading) return
      onSubmit()
    }
  }

  const handleInput = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-800/60 p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= maxLength) {
              onChange(e.target.value)
            }
          }}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Pregunta sobre tu planta..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-800/80 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30"
        />
        <button
          type="submit"
          disabled={isLoading || !value.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
        >
          {isLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </div>
      {value.length > maxLength * 0.8 && (
        <p className="mt-1 text-right text-[10px] text-gray-500">
          {value.length}/{maxLength}
        </p>
      )}
    </form>
  )
}
