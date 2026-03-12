# AI Agent Architecture - Lucvia

## Overview

AI-powered analytics assistant embedded in the Lucvia photovoltaic monitoring platform. Operators can ask natural-language questions about their solar plant performance and receive technically accurate, concise answers in Spanish.

## Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| AI SDK | Vercel AI SDK v5 (`ai`, `@ai-sdk/react`) | Streaming-native, React hooks, provider-agnostic |
| Model Provider | OpenRouter (`@ai-sdk/openai` with custom baseURL) | Unified API for 300+ models, cost control |
| Default Model | `google/gemini-2.5-flash` | Low latency, low cost, strong reasoning for structured data |
| Streaming | `streamText` + `toDataStreamResponse()` | Token-by-token streaming to client |

## Request Flow

```
ChatWidget (client)
  → POST /api/chat  { messages, plantContext }
    → streamText with system prompt + plant context
      → OpenRouter → Gemini Flash
        → streamed response back to useChat hook
```

## Context Injection

Plant context is passed via the request body on every message:

```typescript
interface AgentContext {
  plantId: string
  plantName: string
  dateRange?: { start: string; end: string }
  stringCount: number
}
```

The API route injects this into the system prompt so the model is always aware of which plant is being discussed.

## Components

- `ChatWidget` - Floating chat bubble + conversation panel (client component)
- `InsightCard` - Display card for structured `PlantInsight` objects

## Planned Tool Definitions

The following AI tools are planned for Phase 2 to give the agent direct data access:

| Tool | Description |
|------|-------------|
| `queryPlantAnalytics` | Fetch aggregated energy/power metrics for a date range |
| `lookupStringPerformance` | Get per-string current, voltage, and power ratio |
| `detectAnomalies` | Run anomaly detection query comparing strings against median |
| `getSummaryStats` | Return daily/weekly production summary |

These tools will be registered with `streamText({ tools: { ... } })` and executed server-side via Supabase queries.

## Future Roadmap

1. **RAG with historical data** - Embed plant performance history so the agent can reference trends without tool calls
2. **Automated daily insights** - Cron job that generates a `PlantInsight[]` array each morning and stores it in `plant_insights` table
3. **Alert integration** - Agent can acknowledge and comment on active alerts
4. **Multi-plant context** - Support querying across all plants for fleet-level operators
5. **Export** - Allow users to export conversation + insights as PDF report

## Environment Variables

```
OPENROUTER_API_KEY=sk-or-...
```

See `.env.local.example` for the full list.
