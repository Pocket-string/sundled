import { streamText } from 'ai'
import { google } from '@ai-sdk/google'

export async function POST(req: Request) {
  const { messages, plantContext } = await req.json()

  const systemPrompt = `Eres un asistente experto en monitoreo fotovoltaico para la plataforma Lucvia.
Ayudas a los operadores a entender el rendimiento de su planta solar.
${plantContext ? `Contexto de la planta: ${plantContext.plantName}, ${plantContext.stringCount} strings.` : ''}
Responde siempre en español. Se conciso y tecnico.`

  const result = await streamText({
    model: google('gemini-2.5-flash'),
    system: systemPrompt,
    messages,
  })

  return result.toTextStreamResponse()
}
