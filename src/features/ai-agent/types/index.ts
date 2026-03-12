export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
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
}
