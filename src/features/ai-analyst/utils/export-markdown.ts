import type { UIMessage } from 'ai'
import { isToolUIPart, getToolName } from 'ai'

/**
 * Extracts visible text from a UIMessage's parts and returns markdown.
 */
export function messageToMarkdown(message: UIMessage): string {
  const parts = message.parts ?? []
  const lines: string[] = []

  for (const part of parts) {
    if (part.type === 'text') {
      lines.push(part.text)
    } else if (isToolUIPart(part) && part.state === 'output-available') {
      lines.push(`\n> Consulta: \`${getToolName(part)}\`\n`)
    }
  }

  return lines.join('\n')
}

/**
 * Copies text to clipboard. Returns true on success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Downloads text as a .md file.
 */
export function downloadMarkdown(text: string, filename = 'lucvia-respuesta.md') {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
