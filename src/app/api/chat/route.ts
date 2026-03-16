import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { google } from '@ai-sdk/google'
import { getAnalystTools } from '@/features/ai-analyst/server/tools'
import { buildSystemPrompt } from '@/features/ai-analyst/server/system-prompt'
import { checkRateLimit } from '@/lib/rate-limit'
import type { AgentContext } from '@/features/ai-analyst/types'

export async function POST(req: Request) {
  const body = await req.json()
  const { messages, plantContext } = body as {
    messages: UIMessage[]
    plantContext?: AgentContext
  }

  // Rate limit by plant (demo) or user identifier
  const rateLimitKey = plantContext?.plantId ?? 'anonymous'
  const rateCheck = checkRateLimit(`agent:${rateLimitKey}`, 30, 60 * 60 * 1000)
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: `Has alcanzado el limite de mensajes. Intenta de nuevo en ${Math.ceil(rateCheck.resetInSeconds / 60)} minutos.`,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const systemPrompt = buildSystemPrompt(plantContext ?? undefined)
  const tools = getAnalystTools()
  const modelMessages = await convertToModelMessages(messages)

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: systemPrompt,
    messages: modelMessages,
    tools,
  })

  return result.toUIMessageStreamResponse()
}
