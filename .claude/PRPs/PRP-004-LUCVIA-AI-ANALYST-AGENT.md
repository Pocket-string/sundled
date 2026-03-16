# PRP-004 — Lucvia AI Analyst Agent

> **Tipo**: PRP / Ticket ejecutable
> **Prioridad**: Alta
> **Estado**: PENDIENTE
> **Fecha**: 2026-03-15
> **Stack obligatorio**: Vercel AI SDK v6, @ai-sdk/google (Gemini 2.5 Flash), Supabase, Zustand, React 19
> **Referencias base**: TICKET-001A (Foundation), TICKET-002 (Analytics Layer), Phase 4 Plan
> **Dependencias**: TICKET-001A (completado), TICKET-002 (completado)

---

## 1. Contexto

Lucvia es un SaaS de monitoreo fotovoltaico que analiza el rendimiento de strings solares. Actualmente tiene:

- **693 strings** monitoreados en planta demo (Zaldivia)
- **~40 inversores** distribuidos en 3 CTs
- **3 tablas de datos**: `fact_string` (mediciones brutas), `string_analytics_snapshots` (snapshots con clasificacion), `daily_string_summary` (resumen diario por string)
- **6 servicios de analytics** que computan: clasificacion, perdidas, tendencias, heatmap
- **Un scaffold AI basico**: API route en `/api/chat` con Gemini 2.5 Flash, streaming, sin acceso a datos

El scaffold actual es un endpoint de chat generico sin integracion con la base de datos. No tiene herramientas, no tiene memoria, no genera entregables.

---

## 2. Problema

Los operadores e ingenieros de plantas fotovoltaicas necesitan **respuestas especificas** sobre el rendimiento de sus plantas. Hoy deben:

1. Navegar manualmente entre dashboards, heatmaps y paginas de strings
2. Interpretar graficos y tablas por su cuenta
3. No pueden hacer preguntas ad-hoc ("cuales strings perdieron mas energia esta semana?")
4. No pueden generar reportes ejecutivos o tecnicos automaticamente
5. El conocimiento se pierde entre sesiones — cada analisis parte de cero

**El gap**: Hay datos ricos en la BD, servicios de analytics maduros, pero **no hay una capa conversacional** que los conecte con el usuario de forma inteligente.

---

## 3. Usuario Objetivo

| Persona | Necesidad | Ejemplo de pregunta |
|---------|-----------|---------------------|
| **Operador de planta** | Deteccion rapida de anomalias | "Cuales strings estan bajo rendimiento hoy?" |
| **Ingeniero O&M** | Analisis de tendencias y causas raiz | "Compara INV 3-8 vs INV 3-9 en la ultima semana" |
| **Gerente de operaciones** | Reportes ejecutivos | "Genera un resumen ejecutivo de perdidas del mes" |
| **Cliente/Propietario** | Entendimiento simplificado | "Como esta mi planta? Necesito hacer algo?" |

---

## 4. Objetivo

Construir un **agente analista de datos conversacional** que:

1. **Responde preguntas** sobre rendimiento de la planta sumergiendose en la base de datos
2. **Acumula expertise** — cada consulta SQL exitosa se almacena como una "herramienta aprendida" que puede reutilizar
3. **Genera entregables** — reportes, resumenes ejecutivos, analisis comparativos en formato estructurado (estilo NotebookLM)
4. **Evoluciona** — su stack de queries crece con cada interaccion, haciendolo mas rapido y preciso

---

## 5. Criterios de Exito

### Funcionales
- [ ] El agente responde preguntas sobre rendimiento de strings con datos reales de la BD
- [ ] El agente puede comparar strings, inversores, periodos de tiempo
- [ ] El agente genera entregables estructurados (reporte ejecutivo, analisis tecnico, tabla comparativa)
- [ ] Las queries exitosas se persisten y reutilizan en futuras consultas
- [ ] El agente mantiene contexto dentro de una conversacion
- [ ] La interfaz permite ver, copiar y exportar entregables

### Tecnicos
- [ ] Streaming de respuestas via AI SDK v6 `streamText()`
- [ ] Tool calling con herramientas tipadas (Zod schemas)
- [ ] Latencia de primera respuesta < 2s
- [ ] Queries a BD ejecutadas server-side (nunca expuestas al cliente)
- [ ] Rate limiting por usuario (max 30 mensajes/hora)
- [ ] `pnpm typecheck` y `pnpm build` pasan sin errores

### Calidad
- [ ] El agente NO inventa datos — siempre cita la fuente (tabla, fecha, string_id)
- [ ] Cuando no tiene datos suficientes, lo dice explicitamente
- [ ] Las queries generadas son eficientes (usan indices existentes)

---

## 6. Arquitectura Propuesta

### 6.1 Flujo de Datos

```
Usuario (chat) → React Client → POST /api/chat → AI SDK streamText()
                                                      ↓
                                              Gemini 2.5 Flash
                                              (system prompt + tools)
                                                      ↓
                                              Tool calls ejecutados
                                              server-side contra Supabase
                                                      ↓
                                              Respuesta streamed al cliente
                                              (texto + InsightCards + Deliverables)
```

### 6.2 Capas del Agente

```
┌─────────────────────────────────────────────────┐
│  CAPA 1: Interfaz (Chat + Deliverables Panel)   │
│  - ChatWidget (floating/expandable)             │
│  - MessageList (texto + cards + deliverables)   │
│  - DeliverableViewer (preview + export)         │
│  - QueryStackViewer (queries aprendidas)        │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  CAPA 2: Orquestacion (AI SDK + Tools)          │
│  - System Prompt (dominio fotovoltaico)         │
│  - Tools: queryPlantData, compareStrings,       │
│           generateDeliverable, getQueryStack    │
│  - Context: plantId, dateRange, user role       │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  CAPA 3: Data Layer (Query Engine)              │
│  - QueryExecutor: ejecuta SQL parametrizado     │
│  - QueryStack: queries exitosas persistidas     │
│  - QueryBuilder: construye queries seguras      │
│  - Schema Knowledge: metadata de tablas/cols    │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  CAPA 4: Deliverables Engine                    │
│  - Templates: ejecutivo, tecnico, comparativo   │
│  - Renderer: markdown → componente React        │
│  - Exporter: copiar, descargar MD/PDF           │
└─────────────────────────────────────────────────┘
```

### 6.3 Modelo de Tools (AI SDK Tool Calling)

El agente tendra herramientas tipadas que el LLM invoca segun la pregunta del usuario:

#### Tool 1: `queryPlantData`
```typescript
{
  name: 'queryPlantData',
  description: 'Consulta datos de rendimiento de la planta fotovoltaica',
  parameters: z.object({
    query_type: z.enum([
      'current_status',          // Estado actual de strings
      'string_detail',           // Detalle de un string especifico
      'inverter_summary',        // Resumen por inversor
      'loss_analysis',           // Analisis de perdidas
      'trend',                   // Tendencia en periodo
      'top_deviations',          // Strings con mayor desviacion
      'date_comparison',         // Comparar dos fechas
      'custom'                   // Query personalizada (con restricciones)
    ]),
    plant_id: z.string(),
    filters: z.object({
      string_id: z.string().optional(),
      inverter_id: z.string().optional(),
      date_start: z.string().optional(),
      date_end: z.string().optional(),
      class_filter: z.enum(['green','blue','orange','red','gray']).optional(),
      limit: z.number().max(100).default(20),
    }).optional(),
  }),
  execute: async (params) => { /* server-side query */ }
}
```

#### Tool 2: `compareEntities`
```typescript
{
  name: 'compareEntities',
  description: 'Compara rendimiento entre strings, inversores o periodos',
  parameters: z.object({
    comparison_type: z.enum(['strings', 'inverters', 'periods']),
    entity_a: z.string(),
    entity_b: z.string(),
    plant_id: z.string(),
    date_range: z.object({
      start: z.string(),
      end: z.string(),
    }).optional(),
    metrics: z.array(z.enum([
      'p_string_avg', 'underperf_ratio', 'energy_loss_wh', 'class_distribution'
    ])).default(['p_string_avg', 'underperf_ratio']),
  }),
  execute: async (params) => { /* server-side comparison */ }
}
```

#### Tool 3: `generateDeliverable`
```typescript
{
  name: 'generateDeliverable',
  description: 'Genera un entregable estructurado (reporte, analisis, tabla)',
  parameters: z.object({
    type: z.enum([
      'executive_summary',    // Resumen ejecutivo de planta
      'technical_report',     // Reporte tecnico detallado
      'loss_report',          // Reporte de perdidas con impacto economico
      'comparison_table',     // Tabla comparativa
      'trend_analysis',       // Analisis de tendencias
      'maintenance_alert',    // Alerta de mantenimiento sugerido
    ]),
    plant_id: z.string(),
    date_range: z.object({
      start: z.string(),
      end: z.string(),
    }),
    include_sections: z.array(z.string()).optional(),
  }),
  execute: async (params) => { /* builds deliverable from data */ }
}
```

#### Tool 4: `recallQueryStack`
```typescript
{
  name: 'recallQueryStack',
  description: 'Busca en el stack de queries aprendidas para reutilizar consultas previas exitosas',
  parameters: z.object({
    search_intent: z.string(), // Descripcion en lenguaje natural
    plant_id: z.string(),
  }),
  execute: async (params) => { /* searches persisted query stack */ }
}
```

---

## 7. Modelo de Datos (Nuevas Tablas)

### 7.1 `agent_conversations`
Historial de conversaciones del agente por usuario/planta.

```sql
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT, -- auto-generado del primer mensaje
  message_count INT DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_conv_user ON agent_conversations(user_id, updated_at DESC);
CREATE INDEX idx_agent_conv_plant ON agent_conversations(plant_id, updated_at DESC);
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
```

### 7.2 `agent_messages`
Mensajes individuales de cada conversacion.

```sql
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB, -- [{name, arguments, result}] para mensajes de tool
  deliverable JSONB, -- {type, title, content, sections[]} para entregables
  metadata JSONB,    -- tokens usados, latencia, modelo, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_msg_conv ON agent_messages(conversation_id, created_at);
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
```

### 7.3 `agent_query_stack`
Stack de queries aprendidas — el "cerebro acumulativo" del agente.

```sql
CREATE TABLE agent_query_stack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  intent TEXT NOT NULL,           -- "top strings con mayor perdida esta semana"
  intent_embedding VECTOR(768),   -- para busqueda semantica (futuro)
  query_type TEXT NOT NULL,       -- enum del tool queryPlantData
  parameters JSONB NOT NULL,      -- parametros exactos usados
  result_summary TEXT,            -- resumen del resultado para contexto
  execution_time_ms INT,
  rows_returned INT,
  success_count INT DEFAULT 1,    -- cuantas veces se reutilizo exitosamente
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_query_stack_plant ON agent_query_stack(plant_id, last_used_at DESC);
CREATE INDEX idx_query_stack_intent ON agent_query_stack USING gin(to_tsvector('spanish', intent));
ALTER TABLE agent_query_stack ENABLE ROW LEVEL SECURITY;
```

### 7.4 `agent_deliverables`
Entregables generados, separados para acceso rapido y re-descarga.

```sql
CREATE TABLE agent_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,          -- executive_summary, technical_report, etc.
  title TEXT NOT NULL,
  content_md TEXT NOT NULL,    -- markdown del entregable
  data_snapshot JSONB,         -- datos usados para generarlo (reproducibilidad)
  date_range_start DATE,
  date_range_end DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deliverables_user ON agent_deliverables(user_id, created_at DESC);
CREATE INDEX idx_deliverables_plant ON agent_deliverables(plant_id, created_at DESC);
ALTER TABLE agent_deliverables ENABLE ROW LEVEL SECURITY;
```

---

## 8. System Prompt (Dominio Fotovoltaico)

El system prompt convierte a Gemini en un analista fotovoltaico experto:

```markdown
Eres LUCIA, la analista de datos de Lucvia — una plataforma de monitoreo
de plantas fotovoltaicas.

## Tu rol
Eres una ingeniera de datos especializada en energia solar. Analizas el
rendimiento de strings fotovoltaicos con precision y claridad. Hablas en
espanol y usas terminologia tecnica del sector cuando es apropiado.

## Conocimiento del dominio
- Una planta tiene CTs (centros de transformacion) > Inversores > Strings
- Cada string tiene: corriente (i_string), voltaje (v_string), potencia (p_string)
- p_expected = potencia esperada segun referencia del grupo (P75 del modulo)
- underperf_ratio = p_string / p_expected (1.0 = perfecto, <0.6 = critico)
- Clasificacion: green (>=0.95), blue (0.80-0.95), orange (0.60-0.80), red (<0.60), gray (sin dato)
- energy_loss_wh = delta entre p_string y p_expected, integrado en tiempo
- POA = irradiancia en el plano del arreglo (W/m2)
- Analisis peak-energy: solo se consideran timestamps con POA en el top 5%

## Tablas disponibles
- fact_string: mediciones brutas (ts_local, string_id, i/v/p_string, poa, t_mod)
- string_analytics_snapshots: snapshots con clasificacion y referencia
- daily_string_summary: resumen diario por string (class, loss, ratio)
- dim_trackers: metadata de strings (ct_id, inverter_id, tracker_id, peer_group)
- plants: metadata de planta (name, timezone, string_count, energy_price)

## Reglas
1. NUNCA inventes datos. Si no tienes la informacion, usa tus herramientas para consultarla.
2. Siempre cita la fuente: tabla, fecha, string_id.
3. Cuando generes un entregable, usa formato estructurado con secciones claras.
4. Si una query falla o retorna vacio, informalo al usuario y sugiere alternativas.
5. Prioriza usar el query stack (queries aprendidas) antes de construir nuevas.
6. Para perdidas economicas, usa energy_price de la planta.
```

---

## 9. Flujos UX

### 9.1 Chat Basico
```
Usuario: "Como esta mi planta hoy?"
→ Agent llama: queryPlantData({ query_type: 'current_status', plant_id })
→ Recibe: {green: 451, blue: 205, orange: 9, red: 28, total: 693}
→ Responde: "Tu planta Zaldivia tiene 693 strings. El 65% esta en optimo
   rendimiento. Hay 28 strings en estado critico (rojo), concentrados
   principalmente en INV 3-8 e INV 3-9. Quieres que analice esos inversores?"
```

### 9.2 Analisis Profundo
```
Usuario: "Analiza INV 3-8 en la ultima semana"
→ Agent llama: queryPlantData({ query_type: 'inverter_summary', filters: { inverter_id: 'INV 3-8', date_start: '2026-03-08', date_end: '2026-03-15' }})
→ Recibe: 20 strings, 8 red, 4 orange, 8 green, total_loss: 42.5 kWh
→ Agent llama: queryPlantData({ query_type: 'trend', filters: { inverter_id: 'INV 3-8' }})
→ Recibe: tendencia descendente desde 2026-03-10
→ Responde con analisis detallado + sugiere comparacion con INV 3-9
```

### 9.3 Generacion de Entregable
```
Usuario: "Genera un reporte ejecutivo del mes"
→ Agent llama: generateDeliverable({ type: 'executive_summary', date_range: {...} })
→ El tool ejecuta multiples queries internas, arma el reporte
→ Se renderiza como DeliverableCard en el chat con:
  - Preview del reporte (primeras secciones)
  - Boton "Ver completo" → abre DeliverableViewer (panel lateral/modal)
  - Boton "Copiar Markdown" → clipboard
  - Boton "Descargar" → .md file
→ El entregable se persiste en agent_deliverables para acceso futuro
```

### 9.4 Reutilizacion de Query Stack
```
Usuario: "Cuales strings perdieron mas energia la semana pasada?"
→ Agent llama: recallQueryStack({ search_intent: 'top strings perdida energia semanal' })
→ Encuentra query previa con 5 usos exitosos (success_count: 5)
→ Reutiliza parametros, ejecuta, responde mas rapido
→ Incrementa success_count de esa query
```

---

## 10. Interfaz de Chat

### 10.1 Componentes

| Componente | Responsabilidad |
|-----------|-----------------|
| `AgentPanel` | Panel principal: abre/cierra, lista de conversaciones, chat activo |
| `ChatInput` | Input con placeholder contextual, submit, indicador de carga |
| `MessageBubble` | Renderiza mensajes de user/assistant con markdown |
| `ToolCallCard` | Muestra tool calls del agente (colapsable): "Consulte daily_string_summary..." |
| `DeliverableCard` | Preview del entregable inline con acciones (ver, copiar, descargar) |
| `DeliverableViewer` | Panel lateral (slide-over) con el entregable completo renderizado |
| `QueryStackBadge` | Indicador "X queries aprendidas" con tooltip |
| `ConversationList` | Lista de conversaciones previas con titulo y fecha |

### 10.2 Layout

```
┌────────────────────────────────────────────┐
│  Dashboard / Heatmap / String detail       │  ← pagina actual
│                                            │
│                                            │
│                                            │
│                                            │
│                         ┌──────────────────┤
│                         │  Agent Panel     │  ← slide-over derecho
│                         │  ┌─────────────┐ │
│                         │  │ Messages    │ │
│                         │  │ ...         │ │
│                         │  │ [Deliverable│ │
│                         │  │  Card]      │ │
│                         │  │ ...         │ │
│                         │  ├─────────────┤ │
│                         │  │ [Input...] ▶│ │
│                         │  └─────────────┘ │
│                         │  3 queries ✓     │
└─────────────────────────┴──────────────────┘
```

En mobile: el panel ocupa full screen como un modal.

### 10.3 Trigger
- Boton flotante (FAB) en esquina inferior derecha: icono de LUCIA
- Badge con numero de notificaciones/insights pendientes (futuro)
- Disponible en todas las paginas de planta (dashboard, heatmap, string detail)

---

## 11. Deliverables Engine (Estilo NotebookLM)

### 11.1 Tipos de Entregable

| Tipo | Contenido | Secciones |
|------|-----------|-----------|
| `executive_summary` | Vision general para gerencia | Estado general, KPIs, strings criticos, tendencia, recomendacion |
| `technical_report` | Analisis detallado para ingenieros | Metricas por inversor, distribucion de clases, analisis de perdidas, anomalias detectadas |
| `loss_report` | Impacto economico de perdidas | Total kWh perdidos, costo estimado, top strings, proyeccion mensual |
| `comparison_table` | Tabla comparativa entre entidades | Metricas lado a lado con delta y color coding |
| `trend_analysis` | Evolucion temporal | Graficos de tendencia (datos), puntos de inflexion, forecast basico |
| `maintenance_alert` | Sugerencia de mantenimiento | Strings afectados, severidad, accion sugerida, prioridad |

### 11.2 Formato de Entregable

Cada entregable es un documento Markdown estructurado:

```markdown
# [Titulo del Entregable]
> Planta: Zaldivia | Periodo: 01-15 Mar 2026 | Generado: 15 Mar 2026

## Resumen Ejecutivo
[Parrafo resumen de 3-4 lineas]

## Metricas Clave
| Metrica | Valor | Tendencia |
|---------|-------|-----------|
| Strings activos | 693 | = |
| Performance Index | 91.2% | ↓ -0.8% |
| Perdida total | 128.5 kWh | ↑ +12% |
| Costo estimado | $15.42 | ↑ |

## Strings Criticos
[Tabla con top deviations]

## Recomendaciones
1. Inspeccionar INV 3-8 (8 strings en rojo, tendencia descendente)
2. ...

---
*Generado por LUCIA — Analista AI de Lucvia*
*Datos fuente: daily_string_summary, string_analytics_snapshots*
```

### 11.3 Renderizado

El markdown se renderiza en React con:
- Tablas estilizadas con colores de clasificacion
- Numeros con formato (kWh, %, $)
- Secciones colapsables para reportes largos
- Header con metadata (planta, periodo, fecha de generacion)

---

## 12. Query Stack — Aprendizaje Acumulativo

### 12.1 Ciclo de Vida de una Query

```
1. Usuario hace pregunta
2. Agente decide parametros de tool call
3. Tool ejecuta query contra Supabase
4. Si exitosa (rows > 0, sin error):
   a. Se busca en agent_query_stack si existe intent similar
   b. Si existe: incrementa success_count, actualiza last_used_at
   c. Si no existe: INSERT nueva entrada con intent + parameters
5. Proxima vez que el agente necesite datos similares:
   a. Primero consulta recallQueryStack
   b. Si hay match con success_count alto: reutiliza
   c. Si no: construye nueva query
```

### 12.2 Beneficios

- **Velocidad**: Queries probadas se reutilizan sin re-derivacion
- **Precision**: Las queries que funcionan se refuerzan (success_count sube)
- **Personalizacion**: El stack es por planta — cada planta acumula su propio expertise
- **Transparencia**: El usuario puede ver "3 queries aprendidas" y explorar el stack

### 12.3 Busqueda en el Stack

Fase 1: Busqueda por texto (full-text search con `to_tsvector('spanish', intent)`)
Fase futura: Busqueda semantica con embeddings (columna `intent_embedding VECTOR(768)`)

---

## 13. Seguridad

### 13.1 Queries
- Las queries se ejecutan **server-side** usando el service role client
- El agente NO genera SQL arbitrario — usa funciones predefinidas con parametros validados por Zod
- Los parametros `plant_id` y `org_id` se inyectan server-side desde la sesion autenticada
- Nunca se expone la estructura de la BD al cliente

### 13.2 RLS
- Todas las tablas nuevas tienen RLS habilitado
- Politicas: `org_id = (SELECT org_id FROM org_members WHERE user_id = auth.uid())`
- Las queries del agente usan service role pero filtran por org_id del usuario autenticado

### 13.3 Rate Limiting
- 30 mensajes/hora por usuario (configurable)
- Implementado via contador en memoria (Zustand) + validacion server-side
- Respuesta 429 con mensaje amigable: "Has alcanzado el limite. Intenta en X minutos."

### 13.4 Contenido
- El system prompt prohibe generar contenido no relacionado con la planta
- Si el usuario pide algo fuera de scope, el agente redirige: "Soy LUCIA, tu analista fotovoltaica. Puedo ayudarte con..."

---

## 14. Demo Mode

Para la ruta `/demo/[plantId]/*`:
- El agente funciona **sin autenticacion** (usa plantId de la URL)
- No persiste conversaciones ni query stack (efimero)
- Limita a 10 mensajes por sesion
- No permite generar entregables (solo chat basico)
- Muestra CTA: "Registrate para acceso completo al analista AI"

---

## 15. Blueprint (Fases de Implementacion)

### Fase 0: Migracion de BD
- Crear tablas: `agent_conversations`, `agent_messages`, `agent_query_stack`, `agent_deliverables`
- Politicas RLS para cada tabla
- Indices optimizados

### Fase 1: Query Engine (Data Layer)
- Implementar `QueryExecutor` con funciones por `query_type`
- Conectar con servicios existentes (`getAnalyticsSnapshotDemo`, `getPlantLossSummaryDemo`, etc.)
- Queries nuevas directas a Supabase donde los servicios no cubren
- Validacion Zod de todos los parametros
- Tests unitarios de cada query_type

### Fase 2: Tool Definitions + API Route
- Definir las 4 tools con schemas Zod (queryPlantData, compareEntities, generateDeliverable, recallQueryStack)
- Refactorizar `/api/chat/route.ts` con tools integrados
- System prompt completo con conocimiento del dominio
- Streaming de respuestas con tool results intercalados
- Manejo de errores y fallbacks

### Fase 3: Interfaz de Chat
- `AgentPanel` (slide-over) con estados: cerrado, abierto, expandido
- `ChatInput` con streaming indicator
- `MessageBubble` con soporte markdown + tool call cards
- `ToolCallCard` colapsable ("Consulte la base de datos...")
- Boton FAB flotante en layout de planta
- Responsive: slide-over en desktop, fullscreen en mobile
- Store Zustand para estado del panel y mensajes

### Fase 4: Query Stack (Aprendizaje)
- Logica de persistencia: detectar queries exitosas, buscar similares, insertar/actualizar
- Tool `recallQueryStack` con full-text search
- `QueryStackBadge` en la interfaz
- Vista de queries aprendidas (colapsable en el panel)

### Fase 5: Deliverables Engine
- Templates de cada tipo de entregable (markdown templates con placeholders)
- Tool `generateDeliverable` que ejecuta multiples queries y arma el documento
- `DeliverableCard` inline en el chat
- `DeliverableViewer` (slide-over/modal) con render completo
- Acciones: copiar markdown, descargar .md
- Persistencia en `agent_deliverables`
- Lista de entregables previos accesible desde el panel

### Fase 6: Persistencia de Conversaciones
- CRUD de conversaciones (crear, listar, cargar, eliminar)
- Auto-titulo basado en primer mensaje
- `ConversationList` en el panel
- Restaurar mensajes al reabrir conversacion

### Fase 7: Demo Mode + Polish
- Modo efimero para rutas demo (sin persistencia)
- Rate limiting (client + server)
- Loading states, error states, empty states
- Animaciones de entrada/salida del panel
- Onboarding: primer mensaje sugerido ("Preguntame sobre tu planta")

---

## 16. Riesgos y Blindajes

| Riesgo | Probabilidad | Impacto | Blindaje |
|--------|-------------|---------|----------|
| LLM alucina datos inexistentes | Alta | Critico | System prompt estricto + todas las respuestas deben venir de tool calls, no de conocimiento del modelo |
| Queries lentas en tablas grandes | Media | Alto | Usar indices existentes, LIMIT obligatorio, timeout de 5s por query |
| Costo de API alto por uso intensivo | Media | Medio | Rate limiting + Gemini Flash (modelo economico) + cache de queries recurrentes |
| Usuario inyecta prompt malicioso | Baja | Alto | Parametros validados por Zod, no SQL arbitrario, system prompt con boundaries |
| Entregables con datos incorrectos | Media | Alto | Cada dato en entregable debe trazarse a una query verificable + data_snapshot en JSONB |

---

## 17. Fuera de Scope (No Implementar)

- Busqueda semantica con embeddings (fase futura, columna reservada)
- Generacion de graficos/charts dentro del chat (solo datos tabulares y markdown)
- Integracion con email/Slack para enviar reportes
- Multi-planta en una misma conversacion
- Voz/audio (solo texto)
- Agente autonomo que ejecuta acciones (solo consulta y reporta)
- Export a PDF (solo markdown en fase 1)

---

## 18. Metricas de Exito Post-Launch

| Metrica | Target |
|---------|--------|
| Mensajes promedio por sesion | > 4 |
| Entregables generados por semana | > 2 |
| Queries en stack por planta (30 dias) | > 15 |
| Tasa de respuestas con datos reales (vs genericas) | > 85% |
| Tiempo de primera respuesta | < 2s |

---

## 19. Notas de Implementacion

- **Golden Path**: Gemini 2.5 Flash via `@ai-sdk/google`, streaming con `streamText()`, tool calling nativo
- **Feature-First**: Todo en `src/features/ai-agent/` — components, hooks, services, types, store
- **Reutilizar servicios existentes**: El QueryExecutor debe llamar a funciones de `src/features/analytics/services/` cuando sea posible, no duplicar queries
- **Demo schema**: Las queries demo usan `sunalize.*` (schema demo), produccion usa `public.*`
- **No over-engineer**: Fase 1-3 son el MVP. Query Stack y Deliverables son diferenciales pero pueden ir en sprint separado

---

## 20. Aprendizajes

> Esta seccion crece con cada error encontrado durante implementacion.

*Vacio — se llenara durante la ejecucion del blueprint.*
