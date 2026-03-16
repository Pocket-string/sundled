export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export interface PlantInsight {
  type: 'performance' | 'anomaly' | 'recommendation' | 'summary'
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  affectedStrings?: string[]
  metric?: { label: string; value: number; unit: string }
}

export interface AgentContext {
  plantId: string
  plantName: string
  dateRange?: { start: string; end: string }
  stringCount: number
  energyPrice?: number
}

export interface ToolResult {
  success: boolean
  source: string
  dateRange?: { start: string; end: string }
  data: unknown
  error?: string
}
