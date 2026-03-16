# PRP-004A — Lucvia AI Analyst Agent (Free-Tier Mode)

> **Tipo**: PRP / Ticket ejecutable
> **Prioridad**: Alta
> **Estado**: PENDIENTE
> **Fecha**: 2026-03-15
> **Revisado por**: Xavier (Signal Detection: 6 skills activos → BLUEPRINT)
> **Stack obligatorio**: Next.js 16, TypeScript, Supabase, Tailwind, Zod, Zustand, Vercel AI SDK v6, @ai-sdk/google
> **Referencia fuente**: `PRP-004-LUCVIA-AI-ANALYST-AGENT.md` (vision completa)
> **Dependencias**: TICKET-001A (completado), TICKET-002 (completado)
> **Composition Sequence**: feature-scaffold → supabase-patterns → ai-engine → server-action → harden

---

## 1. Contexto

Lucvia monitorea 693 strings fotovoltaicos en planta Zaldivia. La BD tiene:

| Tabla | Filas | Tamano | Uso |
|-------|-------|--------|-----|
| `sunalize.fact_string` | 265K | 64 MB | Mediciones brutas (14 dias retencion) |
| `sunalize.daily_string_summary` | 56K | 20 MB | Resumenes diarios (90 dias retencion) |
| **Total BD** | | **98 MB** | Free tier: 500 MB |

Existe un scaffold basico en `src/features/ai-agent/`:
- `components/ChatWidget.tsx` — cliente con `@ai-sdk/react`, streaming, layout basico
- `components/InsightCard.tsx` — renderiza `PlantInsight` (no integrado)
- `types/index.ts` — `ChatMessage`, `PlantInsight`, `AgentContext`
- `src/app/api/chat/route.ts` — Gemini 2.5 Flash, streaming, sin tools ni acceso a datos

**Gap**: El agente habla pero no sabe nada. No tiene herramientas, no consulta la BD, no persiste.

---

## 2. Problema

Los usuarios navegan 4+ pantallas para entender el estado de su planta. No pueden:
- Hacer preguntas ad-hoc ("cuales strings perdieron mas energia esta semana?")
- Obtener resumenes ejecutivos rapidos
- Comparar inversores sin navegar ida y vuelta

El PRP-004 original resolvia esto pero con persistencia pesada (4 tablas, JSONB, embeddings). Este PRP-004A mantiene el valor con **persistencia minima** para operar dentro del free tier de Supabase.

---

## 3. Objetivo

Agente analista conversacional que:
1. Responde con datos reales consultando tablas resumidas (no inventa)
2. Usa 4 tools tipados con Zod ejecutados server-side
3. Persiste solo conversaciones + mensajes (2 tablas, retencion 14 dias)
4. Exporta respuestas como Markdown on-demand (sin persistencia)
5. Funciona en demo mode sin persistencia

---

## 4. Principio rector

> **Consultar mucho, persistir poco.**

---

## 5. Inventario de codigo existente

### Conservar y refactorizar

| Archivo actual | Accion | Razon |
|----------------|--------|-------|
| `src/features/ai-agent/types/index.ts` | Renombrar feature a `ai-analyst`, extender types | Base solida, agregar tool types |
| `src/app/api/chat/route.ts` | Refactorizar: agregar tools, system prompt completo | Ya tiene streaming correcto |

### Conservar y reusar

| Archivo | Accion | Razon |
|---------|--------|-------|
| `src/features/ai-agent/components/ChatWidget.tsx` | Mover a `ai-analyst/`, mejorar UI | Ya usa `@ai-sdk/react` correctamente |
| `src/features/ai-agent/components/InsightCard.tsx` | Mover a `ai-analyst/` | Util para renderizar tool results |

### Eliminar

| Archivo | Razon |
|---------|-------|
| `src/features/ai-agent/` (directorio vacio post-move) | Reemplazado por `ai-analyst/` |

### Servicios existentes a reutilizar (NO duplicar)

| Servicio | Funcion | Tool que lo consume |
|----------|---------|---------------------|
| `getAnalyticsSnapshot.ts` | `getAnalyticsSnapshotDemo(plantId, date?)` | `queryPlantStatus` |
| `getDailySummary.ts` | `getPlantLossSummaryDemo(plantId, days)` | `queryPlantStatus` |
| `getDailySummary.ts` | `getStringLossStatsDemo(plantId, stringId)` | `queryTopUnderperformers` |
| `getDailySummary.ts` | `getStringDailySummariesDemo(plantId, stringId, limit)` | `compareEntities` |
| `getDailyClassification.ts` | clasificacion diaria | `queryPlantStatus` |
| `getAvailableDates.ts` | fechas disponibles | contexto para tools |
| `getIntradayPower.ts` | datos intraday | `queryRecentDetail` (fallback) |

---

## 6. Estructura Feature-First

```
src/features/ai-analyst/
├── components/
│   ├── AgentPanel.tsx          — Slide-over (desktop) / fullscreen (mobile)
│   ├── ChatInput.tsx           — Input + submit + loading indicator
│   ├── MessageBubble.tsx       — Renderiza user/assistant con markdown
│   ├── ToolCallCard.tsx        — Card colapsable "Consulte X..."
│   ├── PromptSuggestions.tsx   — 4 prompts sugeridos en estado vacio
│   └── ExportButton.tsx        — Copiar/descargar markdown de respuesta
├── server/
│   ├── tools.ts                — 4 tools con schemas Zod
│   ├── query-executor.ts       — Ejecuta queries llamando servicios existentes
│   └── system-prompt.ts        — System prompt del dominio fotovoltaico
├── schemas/
│   └── index.ts                — Zod schemas para inputs de tools y mensajes
├── store/
│   └── useAgentStore.ts        — Zustand: panel open/closed, messages efimeros
├── types/
│   └── index.ts                — Extendido desde ai-agent/types
└── utils/
    └── export-markdown.ts      — Genera markdown desde respuesta visible
```

---

## 7. Tools del Agente (4 tools, mapeados a servicios)

### Tool 1: `queryPlantStatus`

Estado general de la planta. Fuente principal: tablas resumidas.

```typescript
const queryPlantStatusSchema = z.object({
  plant_id: z.string(),
  date: z.string().optional(),       // default: ultima fecha disponible
  period: z.enum(['today', 'last_7d', 'last_30d']).default('today'),
})
```

**Implementacion**: Llama `getAnalyticsSnapshotDemo()` + `getPlantLossSummaryDemo()`. Retorna: distribucion de clases, total strings, perdida total, top 5 strings criticos.

### Tool 2: `queryTopUnderperformers`

Top N strings/inversores con peor rendimiento.

```typescript
const queryTopUnderperformersSchema = z.object({
  plant_id: z.string(),
  entity_type: z.enum(['string', 'inverter']),
  metric: z.enum(['energy_loss_wh', 'underperf_ratio']).default('energy_loss_wh'),
  date_start: z.string().optional(),
  date_end: z.string().optional(),
  limit: z.number().min(1).max(25).default(10),
})
```

**Implementacion**: Query directa a `daily_string_summary` con ORDER BY metric, GROUP BY inverter_id si `entity_type = 'inverter'`. Reutiliza patron de `getPlantLossSummaryDemo()`.

### Tool 3: `compareEntities`

Compara dos inversores, strings o periodos.

```typescript
const compareEntitiesSchema = z.object({
  plant_id: z.string(),
  comparison_type: z.enum(['strings', 'inverters', 'periods']),
  entity_a: z.string(),
  entity_b: z.string(),
  date_start: z.string().optional(),
  date_end: z.string().optional(),
  metrics: z.array(z.enum([
    'p_string_avg', 'underperf_ratio', 'energy_loss_wh', 'class_distribution'
  ])).default(['p_string_avg', 'underperf_ratio']),
})
```

**Implementacion**: Dos queries paralelas a `daily_string_summary` filtradas por cada entidad. Calcula deltas. Para `periods`: misma entidad en dos rangos de fecha.

### Tool 4: `queryRecentDetail`

Detalle granular acotado. **Solo cuando las tablas resumidas no bastan.**

```typescript
const queryRecentDetailSchema = z.object({
  plant_id: z.string(),
  entity_type: z.enum(['string', 'inverter']),
  entity_id: z.string(),
  date_start: z.string(),
  date_end: z.string(),
})
```

**Restricciones hard-coded** (no negociables):
- Rango maximo: 48 horas
- Limit: 200 filas
- Solo una entidad a la vez

**Implementacion**: Query a `fact_string` con filtros estrictos. Reutiliza patron de `getIntradayPower()`.

---

## 8. Modelo de datos minimo (2 tablas)

### Por que 2 y no 3

El PRP-004A original proponia `agent_query_templates`. Xavier lo elimina del MVP:
- El LLM ya sabe elegir el tool correcto por la pregunta
- Agrega complejidad (UNIQUE constraint, busqueda, cleanup) sin valor validado
- Se puede agregar en Fase futura si hay evidencia de que mejora latencia/precision
- **Ahorro**: 1 tabla menos, 1 indice menos, 0 logica de reuso

### Tabla 1: `agent_conversations`

```sql
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  message_count INT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_conv_user ON agent_conversations(user_id, created_at DESC);
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;

-- RLS: usuario ve solo conversaciones de su organizacion
CREATE POLICY "org_member_access" ON agent_conversations
  FOR ALL TO authenticated
  USING (org_id IN (
    SELECT om.org_id FROM org_members om WHERE om.user_id = auth.uid()
  ))
  WITH CHECK (org_id IN (
    SELECT om.org_id FROM org_members om WHERE om.user_id = auth.uid()
  ));
```

### Tabla 2: `agent_messages`

```sql
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_msg_conv ON agent_messages(conversation_id, created_at);
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

-- RLS: acceso via conversacion (cascada de org_member_access)
CREATE POLICY "conv_member_access" ON agent_messages
  FOR ALL TO authenticated
  USING (conversation_id IN (
    SELECT c.id FROM agent_conversations c
    JOIN org_members om ON om.org_id = c.org_id
    WHERE om.user_id = auth.uid()
  ))
  WITH CHECK (conversation_id IN (
    SELECT c.id FROM agent_conversations c
    JOIN org_members om ON om.org_id = c.org_id
    WHERE om.user_id = auth.uid()
  ));
```

### Proyeccion de storage

| Tabla | Filas/mes (5 users) | Avg row | MB/mes | Con retencion 14d |
|-------|---------------------|---------|--------|--------------------|
| `agent_conversations` | ~300 | 200 B | 0.06 MB | ~0.02 MB |
| `agent_messages` | ~3,600 | 800 B | 2.9 MB | ~1.3 MB |
| **Total** | | | | **~1.3 MB** |

**Impacto en BD**: 98 MB actual + 1.3 MB/mes agente = **insignificante**. Incluso sin cleanup, 1 ano completo serian ~16 MB extra.

---

## 9. System Prompt

```typescript
export const LUCIA_SYSTEM_PROMPT = `Eres LUCIA, la analista de datos de Lucvia.

## Rol
Ingeniera de datos especializada en energia solar fotovoltaica.
Analizas rendimiento de strings solares con precision. Hablas en espanol.

## Dominio
- Planta → CTs → Inversores → Trackers → Strings
- Cada string mide: corriente (i), voltaje (v), potencia (p_string)
- p_expected = potencia esperada (P75 del grupo de modulo)
- underperf_ratio = p_string / p_expected (1.0 = perfecto)
- Clasificacion: green (>=95%), blue (80-95%), orange (60-80%), red (<60%), gray (sin dato)
- energy_loss_wh = diferencia entre p_string y p_expected integrada en tiempo
- POA = irradiancia en plano del arreglo (W/m2)

## Tablas que consultas
- daily_string_summary: resumen diario por string (class, loss, ratio) — TU FUENTE PRINCIPAL
- string_analytics_snapshots: snapshots con clasificacion — SEGUNDA FUENTE
- fact_string: mediciones brutas — SOLO si necesitas detalle de < 48 horas
- dim_trackers: metadata de strings (inverter, tracker, peer_group)
- plants: metadata de planta (name, timezone, energy_price)

## Reglas estrictas
1. NUNCA inventes datos. Siempre usa tus herramientas para consultar.
2. Cita la fuente: tabla consultada, rango de fechas, entidad.
3. Si una consulta retorna vacio, dilo y sugiere alternativas.
4. Prioriza daily_string_summary sobre fact_string.
5. Para perdidas economicas usa energy_price de la planta.
6. Respuestas concisas: parrafo corto + datos clave + recomendacion.
7. Si preguntan algo fuera del ambito fotovoltaico: redirige amablemente.`
```

---

## 10. Limites y Retencion

| Recurso | Limite | Enforcement |
|---------|--------|-------------|
| Mensajes por conversacion | 50 | Server-side antes de INSERT |
| Conversaciones por usuario/planta | 20 | DELETE oldest al crear nueva |
| Retencion de conversaciones | 14 dias | Cleanup oportunista en `saveConversation` action |
| Rate limit mensajes | 30/hora/usuario | In-memory counter + validacion server |
| Mensaje maximo | 1,500 chars | Zod schema en input |
| fact_string max rango | 48 horas | Hard-coded en tool schema |
| fact_string max rows | 200 | Hard-coded en query-executor |
| Top underperformers max | 25 | Zod schema max en tool |
| Demo: mensajes por sesion | 10 | Client-side counter (efimero) |

### Cleanup oportunista

En lugar de un cron, el cleanup se ejecuta **al crear una nueva conversacion**:

```typescript
// En saveConversationAction:
// 1. Contar conversaciones del usuario para esta planta
// 2. Si >= 20: DELETE la mas antigua
// 3. DELETE conversaciones con last_message_at < now() - 14 days
// 4. INSERT nueva conversacion
```

---

## 11. Env vars faltantes

Agregar a `src/lib/env.ts`:

```typescript
GOOGLE_GENERATIVE_AI_KEY: z.string().min(1).optional(),
```

Agregar a `.env.local.example`:

```
GOOGLE_GENERATIVE_AI_KEY=   # Gemini API key for AI Analyst
```

---

## 12. Interfaz

### Layout

```
Desktop:                              Mobile:
┌──────────────────┬──────────┐      ┌──────────────────┐
│  Dashboard       │ Agent    │      │  Agent Panel     │
│                  │ Panel    │      │  (fullscreen)    │
│                  │ (400px)  │      │                  │
│                  │          │      │  [Messages...]   │
│                  │ [Msgs]   │      │                  │
│                  │          │      │  [Input___] [>]  │
│                  │ [Input]  │      └──────────────────┘
└──────────────────┴──────────┘
```

- **Trigger**: FAB en esquina inferior derecha (todas las paginas de planta)
- **Desktop**: slide-over derecho, 400px
- **Mobile**: fullscreen modal
- **Estado vacio**: 4 prompt suggestions + mensaje de bienvenida

### Componentes clave

| Componente | Responsabilidad |
|-----------|-----------------|
| `AgentPanel` | Contenedor: abrir/cerrar, header con titulo, body scrollable |
| `ChatInput` | Textarea + boton submit + streaming indicator |
| `MessageBubble` | Markdown rendering + fuente/timestamp |
| `ToolCallCard` | Colapsable: "Consulte daily_string_summary para 7 dias..." |
| `PromptSuggestions` | 4 botones con preguntas sugeridas |
| `ExportButton` | Boton en cada mensaje assistant: copiar markdown |

---

## 13. Flujos UX

### Flujo 1 — Estado general
```
"Como esta mi planta hoy?"
→ tool: queryPlantStatus({ period: 'today' })
→ "Zaldivia tiene 693 strings. 65% optimo, 28 en rojo.
   Perdida total: 42.5 kWh ($5.10). Foco: INV 3-8 (8 strings rojos)."
```

### Flujo 2 — Top underperformers
```
"Cuales strings perdieron mas esta semana?"
→ tool: queryTopUnderperformers({ metric: 'energy_loss_wh', limit: 5 })
→ Tabla con top 5 + recomendacion
```

### Flujo 3 — Comparacion
```
"Compara INV 3-8 vs INV 3-9"
→ tool: compareEntities({ comparison_type: 'inverters', entity_a: 'INV 3-8', entity_b: 'INV 3-9' })
→ Tabla comparativa con delta
```

### Flujo 4 — Export
```
Usuario hace click en "Copiar" en un mensaje
→ Markdown del mensaje al clipboard (sin persistencia en BD)
```

### Flujo 5 — Demo
```
Usuario en /demo/PLT_A/dashboard abre panel
→ Funciona sin auth, sin persistencia
→ Limite: 10 mensajes
→ CTA al llegar al limite: "Registrate para acceso completo"
```

---

## 14. Seguridad

| Capa | Implementacion |
|------|---------------|
| **Queries** | Server-side via service role, parametros validados con Zod, nunca SQL arbitrario |
| **Multi-tenant** | `plant_id` y `org_id` inyectados desde sesion, nunca del cliente |
| **RLS** | En la misma migracion que crea tablas (ya especificado arriba) |
| **Rate limit** | 30 msg/hora in-memory + validacion en API route |
| **Contenido** | System prompt con boundaries, redireccion si off-topic |
| **Input** | Max 1,500 chars, sanitizado, sin SQL/code injection |

---

## 15. Demo Mode

Para rutas `/demo/[plantId]/*`:
- Sin autenticacion (usa plantId de URL)
- Memoria solo en cliente (Zustand, no persiste)
- Max 10 mensajes por sesion
- No guarda conversaciones ni mensajes en BD
- Al llegar al limite: CTA "Registrate para acceso completo al analista AI"

---

## 16. Blueprint (Fases)

### Fase 0: Migracion + Env (supabase-patterns + harden)

**Entregables:**
- Migracion: 2 tablas (`agent_conversations`, `agent_messages`) + RLS + indices
- `GOOGLE_GENERATIVE_AI_KEY` en `src/lib/env.ts` y `.env.local.example`
- Rate limit basico en `src/lib/rate-limit.ts` (in-memory sliding window)

**Validacion:** Migracion limpia, linter sin errores, env validation pasa

---

### Fase 1: Query Engine + Tools (ai-engine)

**Entregables:**
- `src/features/ai-analyst/server/query-executor.ts` — conecta tools a servicios existentes
- `src/features/ai-analyst/server/tools.ts` — 4 tools con schemas Zod
- `src/features/ai-analyst/server/system-prompt.ts` — LUCIA system prompt
- `src/features/ai-analyst/schemas/index.ts` — schemas compartidos
- `src/features/ai-analyst/types/index.ts` — types extendidos
- Refactorizar `src/app/api/chat/route.ts` — agregar tools, rate limit, plant context

**Validacion:** Cada tool retorna datos reales de planta demo via test manual o unit test

---

### Fase 2: Interfaz (feature-scaffold + frontend)

**Entregables:**
- Mover `ai-agent/` → `ai-analyst/` (renombrar feature)
- `AgentPanel`, `ChatInput`, `MessageBubble`, `ToolCallCard`, `PromptSuggestions`, `ExportButton`
- `useAgentStore.ts` — Zustand store para estado del panel
- FAB flotante integrado en layout de planta
- Responsive: slide-over desktop, fullscreen mobile
- Streaming indicator, estados de error/vacio

**Validacion:** Flujo completo desde planta autenticada — pregunta → respuesta con datos reales

---

### Fase 3: Persistencia + Retencion (server-action)

**Entregables:**
- `src/actions/agent.ts` — `saveConversation`, `saveMessage`, `loadConversation`, `listConversations`
- Cleanup oportunista en `saveConversation`
- Lista de conversaciones previas en el panel
- Limites enforced server-side (50 msg, 20 conv, 14 dias)

**Validacion:** Cerrar y reabrir panel restaura conversacion. Cleanup elimina datos antiguos.

---

### Fase 4: Demo mode + Polish

**Entregables:**
- Modo efimero para rutas demo (sin persistencia)
- Rate limit visual (X mensajes restantes)
- CTA de registro al llegar al limite demo
- Loading states, error states, animaciones
- Onboarding: primer mensaje sugerido

**Validacion:** Demo funcional sin auth. Limites respetados. Build y typecheck limpios.

---

## 17. Criterios de aceptacion

### Funcionales
- [ ] Usuario abre panel AI desde pagina de planta
- [ ] Agente responde con datos reales (no inventa)
- [ ] Top underperformers con tabla acotada
- [ ] Comparacion de dos inversores funcional
- [ ] Export a markdown funciona (copiar al clipboard)
- [ ] Conversaciones se persisten y restauran
- [ ] Demo mode sin auth, efimero, con limites

### Tecnicos
- [ ] `pnpm typecheck` limpio
- [ ] `pnpm build` sin errores
- [ ] Streaming funcional (primera respuesta < 2s)
- [ ] 4 tools ejecutan server-side contra Supabase
- [ ] Rate limit 30 msg/hora enforced
- [ ] RLS sin hallazgos en linter

### Economicos
- [ ] Solo 2 tablas nuevas en BD
- [ ] Sin JSONB pesados (no tool_calls, no metadata, no snapshots)
- [ ] Sin embeddings ni pgvector
- [ ] Retencion agresiva: 14 dias conversaciones, 50 msg/conv
- [ ] Impacto proyectado: < 2 MB/mes

---

## 18. Riesgos y blindajes

| Riesgo | Blindaje |
|--------|----------|
| LLM alucina datos | System prompt estricto + respuestas SOLO de tool calls |
| Queries lentas en fact_string | Hard limit 48h + 200 rows, priorizar daily_summary |
| Costo API Gemini | Flash es el modelo mas barato, rate limit 30/hora |
| Storage crece | Retencion 14 dias + cleanup oportunista |
| Prompt injection | Zod valida todos los parametros, sin SQL arbitrario |
| Scope creep (agregar deliverables/embeddings) | PRP explicito: NO en este ticket |

---

## 19. Fuera de scope explicito

- `agent_deliverables` (tabla) — Fase futura
- `agent_query_templates` / query stack — Fase futura, valor no validado
- Embeddings / pgvector / busqueda semantica
- Generacion de graficos en chat
- Multi-planta en una conversacion
- Envio de reportes por email/Slack
- API publica del agente
- Export a PDF
- Voz/audio

---

## 20. Fase futura (post-MVP, solo si hay evidencia)

| Feature | Trigger para implementar |
|---------|------------------------|
| Query templates persistidos | Metricas muestran que > 50% de preguntas son repetitivas |
| Deliverables engine | Usuarios piden reportes > 3 veces/semana |
| Historial largo (> 14 dias) | Upgrade a Supabase Pro o self-hosted |
| Busqueda semantica | > 500 templates acumulados por planta |

---

## 21. Aprendizajes

> Esta seccion crece con cada error encontrado durante implementacion.

*Vacio — se llenara durante la ejecucion del blueprint.*

---

## 22. Notas de implementacion para Claude Code

- Feature-First: todo en `src/features/ai-analyst/`
- Usar `pnpm` exclusivamente
- **Reutilizar servicios existentes** de `src/features/analytics/services/` — NO duplicar queries
- Demo schema: queries demo usan `sunalize.*`
- NO crear tablas adicionales a las 2 especificadas
- NO agregar JSONB pesado a `agent_messages`
- NO implementar query templates en esta fase
- Si hay conflicto con PRP-004 original, **manda este PRP-004A**
- El directorio `ai-agent` se renombra a `ai-analyst` en Fase 2
