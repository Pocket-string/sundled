'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { AgentContext } from '../types'
import { useAgentStore } from '../store/useAgentStore'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { PromptSuggestions } from './PromptSuggestions'

interface Props {
  context?: AgentContext
}

export function AgentPanel({ context }: Props) {
  const { isOpen, close } = useAgentStore()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', body: { plantContext: context } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context?.plantId],
  )

  const { messages, sendMessage, status } = useChat({ transport })
  const isLoading = status === 'streaming' || status === 'submitted'

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }, [input, isLoading, sendMessage])

  const handleSuggestion = useCallback((prompt: string) => {
    sendMessage({ text: prompt })
  }, [sendMessage])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
        onClick={close}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-gray-800/60 bg-gray-950/95 backdrop-blur-md md:w-[400px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800/60 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
              <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">LUCIA</h2>
              <p className="text-[10px] text-gray-500">Analista solar</p>
            </div>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="mt-6">
              <PromptSuggestions onSelect={handleSuggestion} />
            </div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}
          {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-gray-800/80 px-3.5 py-2.5 text-sm text-gray-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 [animation-delay:0.4s]" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </>
  )
}
