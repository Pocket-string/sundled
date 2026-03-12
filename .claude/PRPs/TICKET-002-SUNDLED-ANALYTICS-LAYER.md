# TICKET-002 — Sundled Analytics Layer

> **Tipo**: PRP / Ticket ejecutable  
> **Prioridad**: Alta  
> **Estado**: Ready for Claude Code  
> **Fecha**: 2026-03-08  
> **Stack obligatorio**: Next.js + TypeScript + Supabase + Tailwind + shadcn/ui + Zod + Zustand + pnpm  
> **Referencias base**:  
> - `docs/context/sundled-master-spec.md`  
> - `docs/prp/ticket-001a-sundled-foundation-mvp.md`

---

## 1) Contexto

`TICKET-001A` deja operativa la base del producto: auth, multi-tenant, onboarding de planta, ingestión manual GPM, persistencia string-level, dashboard mínimo y heatmap básico del último timestamp.

Este ticket transforma esa base en una **capa analítica útil para diagnóstico real**.

La meta ya no es solo “ver datos”, sino **interpretarlos con lógica consistente**, navegar entre timestamps, comparar contra una referencia razonable y priorizar strings problemáticos con una UX que sirva para operación.

Este ticket debe dejar a Sundled en un estado donde un operador pueda usar la app como reemplazo serio del análisis operativo básico hoy resuelto en Power BI/manual.

---

## 2) Dependencia explícita

Este ticket **depende** de que `TICKET-001A Foundation MVP` ya esté implementado y estable.

Precondiciones mínimas:
- auth + RLS funcionando,
- plantas onboardeadas,
- `Trackers.csv` y SVG válidos cargados,
- integración GPM manual funcional,
- `fact_string`, `dim_trackers`, `svg_layout` e `ingestion_jobs` ya operativos.

Si existe conflicto entre este ticket y el `sundled-master-spec.md`, **manda este ticket para esta fase**.

---

## 3) Problema a Resolver

Hoy el Foundation MVP permite visualizar el último snapshot y una semaforización simple. Eso sirve para probar plumbing, pero no alcanza para operación analítica consistente.

Faltan cuatro cosas críticas:

1. una referencia analítica mejor que “promedio simple actual”,
2. selección temporal de snapshots y lectura histórica,
3. heatmap + grid sincronizados con filtros útiles,
4. trazabilidad de cómo se calculó cada clasificación.

Sin eso, la app sigue siendo una visualización básica y no una herramienta de diagnóstico confiable.

---

## 4) Usuario Objetivo y Job To Be Done

### Usuario objetivo principal
Coordinador/a O&M, performance engineer o analista técnico de planta FV.

### Job to be done
“Cuando reviso una planta, necesito elegir un momento de análisis confiable, comparar cada string contra una referencia razonable y detectar rápido dónde están los peores desvíos, para priorizar acciones sin depender de modelos externos ni revisar cientos de filas manualmente.”

### Resultado medible esperado
- El usuario puede seleccionar fecha/timestamp y analizar la planta en ese punto.
- Cada string tiene una clasificación derivada desde una lógica explícita y reproducible.
- El heatmap y la tabla muestran exactamente los mismos valores/clases.
- El detalle de string explica su potencia actual, potencia esperada, ratio y método de referencia.
- El sistema soporta análisis de planta de forma estable sin recalcular toda la lógica en el cliente en cada render.

---

## 5) Objetivo del Ticket

Implementar la **capa analítica operativa** de Sundled con estos pilares:

1. **Motor analítico v1** con `p_expected`, `underperf_ratio`, `class` y fallback explícito.
2. **Persistencia de snapshots analíticos** para no recalcular todo on-demand en el browser.
3. **Dashboard analítico** con selección temporal, severidad, top desvíos y persistencia de fallas.
4. **Heatmap avanzado** sincronizado con grid, filtros y selector de métrica acotado.
5. **Detalle de string** con serie temporal comparativa y trazabilidad del cálculo.
6. **Validación** contra dataset real y tolerancias explícitas.

---

## 6) Alcance

### Sí incluye

#### Feature: analytics-engine
- Cálculo de `p_expected` por string usando historia reciente y POA similar.
- Cálculo de `underperf_ratio`.
- Cálculo de `underperf_delta_w`.
- Clasificación `green | yellow | red | gray`.
- Método de referencia persistido (`same_string_p75`, `same_string_relaxed_p75`, `peer_group_fallback`, `insufficient_data`).
- Sample size persistido para auditoría del cálculo.

#### Feature: analytics-snapshots
- Tabla persistida de snapshots analíticos por `plant_id + string_id + ts_utc`.
- UPSERT idempotente tras sync o rebuild manual.
- Rebuild manual de analytics para un rango acotado.
- Lectura server-side desde snapshot persistido.

#### Feature: dashboard-analytics
- Selector de fecha.
- Selector de timestamp disponible dentro de la fecha.
- Acción rápida “usar máximo POA del día” para elegir snapshot representativo.
- KPI cards analíticas del snapshot seleccionado.
- Distribución por severidad.
- Top strings con mayor desviación.
- Tabla resumida de trackers/inversores más comprometidos.
- Estado de datos insuficientes claramente visible.

#### Feature: heatmap-advanced
- Heatmap SVG basado en snapshot analítico seleccionado.
- Selector de métrica limitado a:
  - `class`
  - `underperf_ratio`
  - `p_string`
  - `p_expected`
  - `poa`
- Filtros por CT, inversor, tracker, severidad y búsqueda por `string_id`.
- Sincronización bidireccional heatmap <-> grid.
- Tooltip con valores analíticos mínimos.
- Panel lateral de detalle corto del string seleccionado.

#### Feature: string-detail-analytics
- Serie temporal de `p_string` vs `p_expected`.
- Serie temporal de `underperf_ratio`.
- Resumen del string seleccionado en el timestamp activo.
- Historial reciente de clasificaciones.
- Visualización del `reference_method` y `reference_sample_size`.

#### Feature: validation-and-parity
- Dataset de validación interna.
- Tests unitarios del motor analítico.
- Tests de integración del rebuild analítico.
- Paridad razonable con la lógica analítica objetivo definida en este ticket.

### No incluye en este ticket
- Stripe / billing / quotas / usage comercial.
- Team invitations o gestión avanzada de miembros.
- API pública / API keys.
- Huawei / FusionSolar.
- Alertas por email, webhook o notificaciones programadas.
- Scheduler automático de sync.
- Soiling calculator completo.
- Open-Meteo.
- Reportes PDF.
- Multi-planta portfolio analytics.
- Predicción / anomaly detection / ML.
- Edición visual del SVG.
- Móvil / PWA / offline.

---

## 7) Supuestos explícitos

- La fuente de datos sigue siendo **solo GPM**.
- La capa analítica trabaja sobre los datos ya cargados por `TICKET-001A`.
- El análisis se centra en **snapshots discretos** de `fact_string`, no en streaming ni realtime.
- La primera meta es una analítica **estable, explicable y operativa**, no replicar al 100% toda la sofisticación histórica de Power BI.
- Si no hay evidencia suficiente para calcular una referencia confiable, el resultado debe ser **gray**, no un número inventado.

---

## 8) Diseño de Producto

### 8.1 Rutas impactadas

```txt
/(app)
  /plants/[plantId]
  /plants/[plantId]/heatmap
  /plants/[plantId]/strings/[stringId]
```

No crear una nueva sección comercial ni nuevas rutas innecesarias. Este ticket mejora las rutas ya existentes del dominio planta.

### 8.2 Flows principales

#### Flow 1 — Selección de snapshot analítico
1. Usuario entra al detalle de planta.
2. Selecciona una fecha con datos.
3. Ve los timestamps disponibles para esa fecha.
4. Puede elegir manualmente un timestamp o usar “máximo POA del día”.
5. El dashboard, heatmap y tabla cambian de forma consistente al snapshot seleccionado.

#### Flow 2 — Diagnóstico visual
1. Usuario abre heatmap.
2. Aplica filtros por CT, inversor, severidad o búsqueda.
3. Ve los strings coloreados según la métrica seleccionada.
4. Hace click en un string.
5. El grid resalta la misma fila y se abre panel lateral con detalle corto.

#### Flow 3 — Diagnóstico profundo
1. Usuario abre un string.
2. Ve `p_string`, `p_expected`, `underperf_ratio`, `class` y `reference_method` para el timestamp activo.
3. Revisa la serie temporal reciente.
4. Evalúa persistencia del desvío antes de accionar.

#### Flow 4 — Rebuild analítico
1. Usuario `owner/admin/operator` entra a planta.
2. Lanza rebuild analítico para rango acotado.
3. El sistema recalcula snapshots derivados y hace UPSERT.
4. El dashboard usa los nuevos resultados sin recalcular todo en cliente.

### 8.3 Estados y edge cases

#### Empty states
- Planta con datos raw pero sin snapshot analítico: mostrar CTA “Generar análisis”.
- Fecha sin timestamps válidos: mostrar mensaje claro.
- String sin suficiente historia: mostrar `gray` + explicación.

#### Loading
- Skeletons en cards, grid y chart.
- Cambios de timestamp con estado de carga visible.

#### Error
- Rebuild fuera de rango permitido.
- Snapshot solicitado inexistente.
- Datos incompletos para métrica seleccionada.
- Inconsistencia entre `dim_trackers` y analytics snapshot.

#### Permisos
- `viewer`: solo lectura.
- `owner/admin/operator`: lectura + rebuild analítico.

### 8.4 Copy UX mínimo
- “Selecciona una fecha para analizar la planta.”
- “Usando el timestamp de mayor POA del día.”
- “No hay suficientes datos para calcular una referencia confiable.”
- “Análisis recalculado correctamente.”
- “No fue posible recalcular el análisis para el rango solicitado.”
- “Mostrando strings con datos insuficientes en gris.”

---

## 9) Diseño Técnico (Golden Path)

### 9.1 Decisión de arquitectura

La analítica **no** debe vivir como cálculo pesado en el cliente.

Regla:
- calcular server-side,
- persistir snapshot derivado,
- leer snapshot en páginas y componentes,
- usar Zustand solo para estado de UI del heatmap,
- no duplicar lógica entre browser y servidor.

### 9.2 Estructura Feature-First esperada

```txt
src/
  app/
    (app)/
      plants/[plantId]/page.tsx
      plants/[plantId]/heatmap/page.tsx
      plants/[plantId]/strings/[stringId]/page.tsx
  features/
    analytics/
      components/
      lib/
      services/
      schemas/
      types/
    dashboard/
      components/
      lib/
      services/
    heatmap/
      components/
      lib/
      store/
      services/
    strings/
      components/
      lib/
      services/
    shared/
  actions/
    analytics.ts
    dashboard.ts
    heatmap.ts
    strings.ts
```

### 9.3 Modelo de datos adicional

#### Nueva tabla: `string_analytics_snapshots`

Campos conceptuales:
- `id`
- `org_id`
- `plant_id`
- `ts_utc`
- `ts_local`
- `string_id`
- `svg_id`
- `inverter_id`
- `tracker_id`
- `dc_in`
- `peer_group`
- `poa`
- `p_string`
- `p_expected`
- `underperf_ratio`
- `underperf_delta_w`
- `class` (`green | yellow | red | gray`)
- `reference_method` (`same_string_p75 | same_string_relaxed_p75 | peer_group_fallback | insufficient_data`)
- `reference_sample_size`
- `computed_at`
- `created_at`
- `updated_at`

#### Reglas de modelado
- `UNIQUE (plant_id, string_id, ts_utc)`.
- Incluir `org_id` para simplificar RLS.
- Índices mínimos:
  - `(plant_id, ts_utc)`
  - `(plant_id, class, ts_utc)`
  - `(plant_id, inverter_id, ts_utc)`
  - `(plant_id, tracker_id, ts_utc)`
- `UPSERT` idempotente en rebuild o post-sync.

### 9.4 RLS y seguridad

- RLS activa desde la misma migración.
- `SELECT`: miembros de la misma `org_id`.
- `INSERT/UPDATE/DELETE`: solo `owner/admin/operator`.
- `viewer`: sin capacidad de rebuild.
- No exponer lógica ni parámetros de rebuild al cliente sin validación server-side.
- Mantener validación Zod en toda acción de analytics.

### 9.5 Validaciones

#### Rebuild analítico
- `plant_id` válido y perteneciente a la org.
- Rango de fechas acotado.
- Máximo permitido para rebuild manual: **7 días** por ejecución.
- No permitir dos rebuilds analíticos `running` simultáneos para la misma planta.

#### Selector temporal
- La fecha debe existir dentro de los datos de la planta.
- El timestamp debe pertenecer a la fecha seleccionada.
- La opción “máximo POA del día” debe usar solo registros válidos del día.

#### Heatmap
- Solo métricas permitidas.
- Solo strings existentes en `svg_layout` y/o `dim_trackers`.
- Si el string existe en data pero no en SVG, se ve en grid pero no se inventa shape.

---

## 10) Lógica Analítica v1

Esta es la lógica oficial de este ticket. No abrir caminos alternativos.

### 10.1 Registros elegibles

Un registro puede participar en cálculo analítico solo si cumple:
- `poa` no nulo,
- `poa >= 200`,
- `p_string` no nulo,
- `p_string > 0`,
- `string_id` válido.

### 10.2 Cálculo de `p_expected`

Orden de fallback obligatorio:

#### Método 1 — `same_string_p75`
- Buscar historia del mismo `string_id` en los últimos **30 días**.
- Filtrar registros con `abs(poa - current_poa) <= 50`.
- Usar solo registros elegibles.
- Requerir `reference_sample_size >= 12`.
- `p_expected = percentile_75(p_string)`.

#### Método 2 — `same_string_relaxed_p75`
- Si el método 1 no cumple sample size.
- Repetir búsqueda en últimos **30 días**.
- Filtrar con `abs(poa - current_poa) <= 100`.
- Requerir `reference_sample_size >= 12`.
- `p_expected = percentile_75(p_string)`.

#### Método 3 — `peer_group_fallback`
- Si el método 2 falla.
- Usar el snapshot actual del mismo `peer_group` para la planta y timestamp.
- Considerar strings del mismo grupo con datos válidos.
- Requerir `reference_sample_size >= 5`.
- `p_expected = percentile_75(p_string)` del grupo en ese timestamp.

#### Método 4 — `insufficient_data`
- Si todos fallan.
- `p_expected = null`
- `underperf_ratio = null`
- `class = gray`

### 10.3 Cálculo de `underperf_ratio`

- `underperf_ratio = p_string / p_expected`
- Si `p_expected` es nulo o `<= 0`, devolver `null`

### 10.4 Cálculo de `underperf_delta_w`

- `underperf_delta_w = max(p_expected - p_string, 0)`
- Si no hay `p_expected`, devolver `null`

### 10.5 Clasificación

- `green`: `underperf_ratio >= 0.95`
- `yellow`: `underperf_ratio >= 0.80 && < 0.95`
- `red`: `underperf_ratio < 0.80`
- `gray`: sin dato suficiente

### 10.6 Snapshot representativo por defecto

Al entrar a una planta:
- si el usuario no eligió timestamp manualmente,
- usar el **último día con datos**,
- y dentro de ese día usar el **timestamp con mayor POA válido**.

No usar por defecto el último registro nocturno ni un timestamp con POA irrelevante.

---

## 11) UX/Flows por Pantalla

### 11.1 Planta — Dashboard analítico

Debe mostrar:
- selector de fecha,
- selector de timestamp,
- quick action “máximo POA del día”,
- cards:
  - total strings con snapshot,
  - total green,
  - total yellow,
  - total red,
  - total gray,
- top 10 strings por `underperf_delta_w`,
- resumen por inversor/tracker con conteo de severidad,
- acceso directo a heatmap y strings críticos.

### 11.2 Heatmap avanzado

Debe mostrar:
- SVG renderizado,
- selector de métrica,
- filtros,
- leyenda,
- grid sincronizado,
- tooltip y panel lateral.

#### Decisión UX
No implementar todavía multiselect complejo, edición SVG, palettes exóticas ni configuración avanzada de escalas. Debe ser útil y simple.

### 11.3 Detalle de string

Debe mostrar:
- `string_id`, `tracker`, `inverter`, `peer_group`,
- snapshot activo,
- `p_string`, `p_expected`, `underperf_ratio`, `class`,
- `reference_method`, `reference_sample_size`,
- chart de serie temporal reciente,
- historial reciente de clasificaciones.

---

## 12) Tareas Técnicas

### Fase 0 — Base analítica
- [ ] Crear migración para `string_analytics_snapshots`.
- [ ] Activar RLS y policies.
- [ ] Crear índices mínimos.
- [ ] Crear tipos y esquemas Zod de analytics.
- [ ] Implementar motor analítico en `src/features/analytics/lib`.
- [ ] Implementar helpers server-side para obtener fechas/timestamps disponibles.

### Fase 1 — Rebuild y persistencia
- [ ] Crear Server Action para rebuild analítico.
- [ ] Validar rango máximo de 7 días.
- [ ] Bloquear concurrencia por planta.
- [ ] Implementar UPSERT idempotente.
- [ ] Integrar rebuild analítico post-sync cuando aplique.
- [ ] Registrar metadata mínima del proceso.

### Fase 2 — Dashboard analítico
- [ ] Extender página de planta con selector temporal.
- [ ] Implementar cards analíticas.
- [ ] Implementar tabla de top desvíos.
- [ ] Implementar resumen por tracker/inversor.
- [ ] Manejar empty/loading/error states.

### Fase 3 — Heatmap avanzado
- [ ] Reemplazar lectura “latest raw snapshot” por snapshot analítico persistido.
- [ ] Implementar selector de métrica acotado.
- [ ] Implementar filtros por CT, inversor, tracker, severidad y búsqueda.
- [ ] Implementar sincronización heatmap <-> grid.
- [ ] Implementar tooltip + panel lateral.
- [ ] Mantener Zustand solo para estado de UI.

### Fase 4 — Detalle de string
- [ ] Extender detalle con snapshot activo.
- [ ] Agregar chart `p_string vs p_expected`.
- [ ] Agregar chart `underperf_ratio`.
- [ ] Mostrar `reference_method` y sample size.
- [ ] Agregar historial reciente de clases.

### Fase 5 — Calidad y blindaje
- [ ] Tests unitarios de percentil, fallback y clasificación.
- [ ] Tests de integración del rebuild.
- [ ] E2E de navegación dashboard → heatmap → string detail.
- [ ] Validar consistencia heatmap/grid/detail.
- [ ] Documentar riesgos y decisiones en el PRP y/o memoria del proyecto.

---

## 13) Criterios de Aceptación

### Funcionales
- [ ] Un usuario puede seleccionar fecha y timestamp de análisis en una planta con datos.
- [ ] Si el usuario no selecciona timestamp, la app usa máximo POA del último día con datos.
- [ ] El sistema genera `string_analytics_snapshots` persistidos y reutilizables.
- [ ] El heatmap, el grid y el detalle de string muestran los mismos valores para el mismo snapshot.
- [ ] Cada string muestra `reference_method` y `reference_sample_size` cuando corresponda.
- [ ] Los strings sin datos suficientes quedan `gray` y no reciben una referencia inventada.
- [ ] El rebuild analítico manual funciona solo para `owner/admin/operator`.
- [ ] El rebuild es idempotente y no genera duplicados por `plant_id + string_id + ts_utc`.

### Técnicos
- [ ] No existe cálculo pesado duplicado entre cliente y servidor.
- [ ] La lectura principal de páginas analíticas sale desde snapshot persistido.
- [ ] RLS bloquea lectura y escritura cross-tenant.
- [ ] El rebuild valida rango y concurrencia.
- [ ] Build, lint, typecheck y tests relevantes quedan en verde.

### Calidad analítica
- [ ] El motor respeta exactamente el orden de fallback definido en este ticket.
- [ ] En dataset de validación, la clasificación final se comporta de forma consistente y explicable.
- [ ] El usuario puede identificar rápidamente los strings rojos y su desviación en watts.

---

## 14) Plan de Pruebas

### Unit tests
- cálculo percentil 75,
- cálculo `underperf_ratio`,
- cálculo `underperf_delta_w`,
- clasificación semáforo,
- fallback `same_string_p75`,
- fallback `same_string_relaxed_p75`,
- fallback `peer_group_fallback`,
- `insufficient_data`.

### Integration tests
- rebuild analítico para rango válido,
- bloqueo de rango inválido,
- UPSERT sin duplicados,
- policies RLS sobre `string_analytics_snapshots`.

### E2E
- login → planta → seleccionar fecha/timestamp → ver dashboard,
- abrir heatmap y filtrar por severidad,
- click en string del SVG resalta fila correcta,
- abrir detalle de string y verificar consistencia del snapshot.

### Validación manual recomendada
- usar planta ANGAMOS,
- correr sync real o dataset representativo,
- recalcular analytics,
- comparar casos rojos/amarillos/grises con criterio operativo esperado.

---

## 15) Riesgos y Blindajes

### Riesgo 1 — Recalcular todo en frontend
**Blindaje:** el motor analítico corre server-side y persiste resultado. El cliente solo consume snapshots.

### Riesgo 2 — Dos verdades analíticas distintas
**Blindaje:** una sola implementación oficial en `features/analytics/lib`. Heatmap, dashboard y detail consumen la misma fuente derivada.

### Riesgo 3 — Inventar referencia con datos pobres
**Blindaje:** fallback explícito y `gray` cuando no hay soporte suficiente.

### Riesgo 4 — Scope creep hacia producto comercial
**Blindaje:** no crear billing, plans, quotas, team, alerts, API pública ni integraciones extras en este ticket.

### Riesgo 5 — UX demasiado compleja en heatmap
**Blindaje:** selector de métrica acotado, filtros simples, sin editor SVG ni configuración analítica avanzada.

### Riesgo 6 — Queries pesadas e inestables
**Blindaje:** persistir `string_analytics_snapshots`, indexar correctamente y limitar rebuild manual.

---

## 16) Notas de Implementación (SaaS Factory)

- Seguir **Golden Path** sin alternativas tecnológicas.
- Mantener organización **Feature-First**.
- Priorizar **Server Actions** para operaciones internas.
- No introducir una API REST interna paralela salvo necesidad real muy justificada.
- Toda validación de entrada con **Zod**.
- Toda tabla nueva con **RLS en la misma migración**.
- No meter features del ticket 003 en este ticket.
- No intentar lograr “paridad absoluta” con modelos históricos externos en esta fase; sí lograr una lógica sólida, explícita y auditable.

---

## 17) Ticket Final para Claude Code

### Título
Implementar `TICKET-002 — Sundled Analytics Layer`

### Objetivo
Convertir la base del `TICKET-001A` en una capa analítica operativa persistida, con motor de referencia `p_expected`, snapshots derivados, dashboard analítico, heatmap avanzado y detalle de string consistente.

### Instrucciones de ejecución
1. Usa como referencia `docs/context/sundled-master-spec.md` solo para contexto general.
2. Usa `docs/prp/ticket-001a-sundled-foundation-mvp.md` como dependencia directa ya implementada.
3. Implementa únicamente el alcance descrito en este ticket.
4. No avances features del ticket comercial.
5. Mantén una sola fuente de verdad analítica.
6. Entrega por fases pequeñas validables.

### Definition of Done
- snapshots analíticos persistidos,
- dashboard analítico usable,
- heatmap sincronizado con grid,
- detalle de string con trazabilidad del cálculo,
- rebuild manual estable,
- tests clave pasando,
- sin contaminar el scope con billing/team/API/alerts.

