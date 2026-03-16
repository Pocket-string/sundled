'use client'

import type { UIMessage } from 'ai'
import { isToolUIPart, getToolName } from 'ai'
import Markdown from 'react-markdown'
import { ToolCallCard } from './ToolCallCard'
import { ExportButton } from './ExportButton'

interface Props {
  message: UIMessage
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] space-y-1`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-emerald-600/20 text-emerald-100'
              : 'bg-gray-800/80 text-gray-200'
          }`}
        >
          {message.parts?.map((part, i) => {
            if (part.type === 'text') {
              if (isUser) {
                return (
                  <span key={i} className="whitespace-pre-wrap">
                    {part.text}
                  </span>
                )
              }
              return (
                <div key={i} className="prose-agent">
                  <Markdown>{part.text}</Markdown>
                </div>
              )
            }
            if (isToolUIPart(part)) {
              return (
                <ToolCallCard
                  key={i}
                  toolName={getToolName(part)}
                  state={part.state}
                  input={part.input as Record<string, unknown>}
                />
              )
            }
            return null
          })}
        </div>
        {!isUser && <ExportButton message={message} />}
      </div>
    </div>
  )
}
