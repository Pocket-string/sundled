# TICKET-001A — Sundled Foundation MVP

> **Tipo**: PRP / Ticket ejecutable
> **Prioridad**: Crítica
> **Estado**: Ready for Claude Code
> **Fecha**: 2026-03-08
> **Stack obligatorio**: Next.js + TypeScript + Supabase + Tailwind + shadcn/ui + Zod + Zustand + pnpm
> **Referencia base**: `docs/context/sundled-master-spec.md`

---

## 1) Contexto

Este ticket implementa la **base fundacional usable** de Sundled para el primer caso real de validación.

No debe intentar construir toda la plataforma. Debe dejar operativo el camino mínimo para:

1. autenticación,
2. aislamiento multi-tenant,
3. alta de planta,
4. carga de archivos de configuración,
5. sincronización manual desde GPM,
6. persistencia string-level,
7. dashboard operativo mínimo,
8. heatmap SVG mínimo del último timestamp.

La planta objetivo para validar este MVP es **ANGAMOS**.

---

## 2) Problema a Resolver

Hoy el flujo depende de portales externos, análisis manual y artefactos desconectados. Eso hace lenta la detección de bajo rendimiento y dificulta usar el layout SVG como herramienta operativa.

Este MVP debe reemplazar ese flujo por una experiencia web donde un operador pueda:

- crear y configurar una planta,
- cargar Trackers.csv y SVG,
- ejecutar una sincronización manual,
- ver el estado de la ingestión,
- inspeccionar strings problemáticos,
- navegar visualmente el layout.

---

## 3) Usuario Objetivo y Job To Be Done

### Usuario objetivo principal
Coordinador/a O&M u operador técnico de planta.

### Job to be done
“Cuando quiero revisar una planta FV, necesito cargar su configuración, sincronizar los datos del portal y detectar rápidamente qué strings están rindiendo mal, para priorizar acciones en terreno sin depender de Power BI ni procesos manuales.”

### Resultado medible esperado
- La planta ANGAMOS queda onboardeada en la app.
- Un usuario autenticado puede lanzar una sincronización manual y ver su resultado.
- El dashboard muestra lecturas por string y un heatmap funcional del último timestamp.
- El sistema bloquea acceso cross-tenant.

---

## 4) Alcance del MVP

### Sí incluye

#### Feature: auth
- Login con Supabase Auth (email/password)
- Logout
- Bootstrap automático de organización y membresía owner en primer registro
- Middleware de protección de rutas privadas
- Helpers server-side para auth y org context

#### Feature: plants
- Crear planta
- Editar datos base de planta
- Ver detalle de planta
- Cargar Trackers.csv
- Cargar SVG layout
- Configurar integración GPM (credenciales cifradas + query IDs)

#### Feature: ingestion
- Ejecutar sincronización manual para una planta
- Persistir job y estado del job
- Descargar/parsing de CSVs GPM requeridos para el MVP
- ETL TypeScript basado en la lógica validada del documento maestro
- UPSERT de `fact_string`
- Vista de historial de jobs

#### Feature: dashboard
- KPI cards mínimas: última sincronización, total strings configurados, total strings con lectura, total strings bajo umbral
- Tabla de strings del último timestamp con filtros por CT, inversor y estado
- Vista de detalle simple por string con serie temporal básica

#### Feature: heatmap
- Heatmap SVG mínimo del último timestamp
- Semaforización simple por underperformance
- Click en string para ver detalle lateral
- Sin edición del SVG

#### Feature: platform-foundation
- Multi-tenant base con `organizations` + `org_members`
- RLS desde día 0
- Validación Zod
- `env.ts` con validación de variables de entorno
- Security headers
- Rate limit en trigger manual de sync
- Auditoría mínima en jobs

### No incluye en este ticket
- Stripe / billing
- Team invitations
- API pública / API keys
- Huawei / FusionSolar
- Schedules automáticos y cron UI
- Alertas por email/webhook
- Soiling engine completo
- Open-Meteo
- Reportes PDF
- PWA / móvil / offline
- Comparativas multi-planta avanzadas
- Predicción / anomaly detection
- CRUD de reglas de alertas
- Heatmap avanzado con multiselect, slider temporal, export o edición

---

## 5) Supuestos explícitos

- El primer portal soportado será **solo GPM**.
- El primer caso real de validación es ANGAMOS.
- La sincronización del MVP será **manual**, no automática.
- El heatmap del MVP usará el **último timestamp disponible**.
- La clasificación inicial de strings usará un cálculo simple, estable y reproducible.
- Se prioriza una base robusta y usable antes que completeness de features comerciales.

---

## 6) Diseño de Producto

### 6.1 Rutas del MVP

```txt
/(public)
  /login

/(app)
  /dashboard
  /plants
  /plants/new
  /plants/[plantId]
  /plants/[plantId]/settings
  /plants/[plantId]/ingestion
  /plants/[plantId]/heatmap
  /plants/[plantId]/strings/[stringId]
```

### 6.2 Flows principales

#### Flow 1 — Primer acceso
1. Usuario se registra o inicia sesión.
2. Si no tiene organización, se crea una `organization` y membership `owner`.
3. Entra al dashboard vacío.
4. CTA principal: “Crear primera planta”.

#### Flow 2 — Onboarding de planta
1. Usuario crea planta.
2. Completa datos base.
3. Sube `Trackers.csv`.
4. Sube SVG layout.
5. Configura credenciales/query IDs GPM.
6. El sistema valida archivos y deja la planta `ready_to_sync`.

#### Flow 3 — Sync manual
1. Usuario entra a la vista de ingestión.
2. Selecciona rango permitido para sync manual.
3. Ejecuta “Sync now”.
4. El sistema crea `ingestion_job`.
5. La UI muestra estado: `pending | running | success | partial | error`.
6. Al terminar, el usuario puede ir a dashboard o heatmap.

#### Flow 4 — Diagnóstico
1. Usuario abre dashboard de planta.
2. Ve KPI cards y tabla de strings del último timestamp.
3. Puede entrar al heatmap.
4. Hace click en un string y abre panel con detalle.

### 6.3 Estados y edge cases

#### Empty states
- Sin plantas: mostrar CTA para crear planta.
- Planta sin `Trackers.csv` o SVG: mostrar checklist de onboarding incompleto.
- Planta sin sync ejecutada: mostrar CTA para sincronizar.
- Sync sin datos válidos: mostrar mensaje claro y link al job.

#### Loading
- Skeletons en dashboard y tabla.
- Job status con polling o revalidación periódica simple.

#### Error
- Credenciales GPM inválidas.
- CSV inválido.
- SVG inválido.
- `dim_trackers` no matchea con SVG.
- Job fallido por timeout, parsing o descarga.

#### Permisos
- `viewer`: solo lectura.
- `owner/admin`: configuración de planta y sync manual.
- `operator`: lectura + sync manual.

### 6.4 Copy UX mínimo
- “Crea tu primera planta para comenzar.”
- “Faltan archivos de configuración para habilitar la sincronización.”
- “Sincronización en progreso.”
- “Sincronización completada.”
- “Sincronización completada con observaciones.”
- “No fue posible procesar el archivo cargado.”
- “Credenciales inválidas o acceso rechazado por el portal.”
- “No hay datos disponibles para este rango.”

---

## 7) Diseño Técnico (Golden Path)

### 7.1 Arquitectura

- Next.js App Router
- Server Actions para CRUD interno y acciones del app
- Supabase para Auth + Postgres + Storage
- Zod para validaciones
- Zustand solo donde aporte valor real (estado local de heatmap)
- pnpm obligatorio

### Decisión importante
En este ticket **no** se implementará una API REST interna duplicada para el app. El flujo interno debe resolverse con **Server Actions** y consultas server-side. Solo crear route handlers si son estrictamente necesarios.

---

### 7.2 Modelo de datos conceptual del MVP

#### Plataforma

##### organizations
- id
- name
- slug
- created_at
- updated_at

##### org_members
- id
- org_id
- user_id
- role (`owner | admin | operator | viewer`)
- created_at

#### Dominio

##### plants
- id
- org_id
- name
- slug
- timezone
- lat
- lon
- ct_count
- inverter_count
- string_count
- module_power_w
- energy_price
- cleaning_cost
- currency
- portal_type (`gpm` en este ticket)
- is_active
- onboarding_status (`draft | files_ready | ready_to_sync | active`)
- last_sync_at
- last_sync_status (`success | partial | error | null`)
- created_at
- updated_at

##### plant_integrations
- id
- org_id
- plant_id
- portal_type
- credentials_encrypted
- credentials_iv
- credentials_tag
- query_ids_json
- is_active
- created_at
- updated_at

##### dim_trackers
- id
- org_id
- plant_id
- ct_id
- inverter_id
- inverter_base
- tracker_id
- string_label
- dc_in
- module
- string_id
- svg_id
- inverter_dc_key
- peer_group
- created_at
- updated_at

##### svg_layout
- id
- org_id
- plant_id
- svg_id
- tag
- css_class
- title
- x
- y
- width
- height
- created_at

##### fact_string
- id
- org_id
- plant_id
- ts_local
- ts_utc
- string_id
- svg_id
- inverter_id
- inverter_dc_key
- dc_in
- module
- peer_group
- i_string
- v_string
- p_string
- poa
- t_mod
- created_at
- updated_at

##### ingestion_jobs
- id
- org_id
- plant_id
- triggered_by
- status (`pending | running | success | partial | error | cancelled`)
- date_start
- date_end
- records_loaded
- records_expected
- error_message
- manifest_json
- started_at
- completed_at
- created_at
- updated_at

### Decisiones de modelado
- Agregar `org_id` directamente a todas las tablas de dominio y operación para simplificar RLS.
- No crear `plans`, `billing`, `dim_date`, `alerts`, `production_readings` ni `cleaning_events` en este ticket.
- No implementar particionado declarativo todavía. Primero validar carga real, consultas y cardinalidad.

---

### 7.3 RLS y Seguridad

#### RLS obligatorio
- RLS activado en la misma migración que crea cada tabla.
- Patrón de aislamiento por `org_id` + `org_members`.
- Ninguna tabla de dominio sin policy.

#### RBAC MVP
- `owner/admin`: CRUD plantas + settings + sync
- `operator`: lectura + sync
- `viewer`: solo lectura

#### Credenciales
- Credenciales GPM cifradas con AES-256-GCM
- Nunca exponer credenciales en logs
- Nunca persistir credenciales en texto plano

#### Otras capas obligatorias
- `src/lib/env.ts` con Zod al arranque
- Security headers en `next.config.ts`
- Rate limit en la acción o route del trigger manual de sync
- Validación Zod en uploads, formularios y parámetros

---

### 7.4 Validaciones

#### Plant form
- `name` requerido
- `slug` requerido y único dentro de la org
- `timezone` requerida
- `lat/lon` válidas
- `string_count >= 1`
- `energy_price > 0`
- `cleaning_cost > 0`
- `portal_type = gpm`

#### Trackers.csv
- Archivo requerido para habilitar sync
- Columnas mínimas esperadas según lógica actual
- `string_id/svg_id` deben poder derivarse consistentemente
- Rechazar duplicados críticos

#### SVG
- Archivo SVG válido
- Extraer ids/rects esperados
- Detectar mismatch severo con `dim_trackers`

#### GPM config
- Credenciales requeridas
- Query IDs mínimos requeridos para el MVP
- Validación estructural del JSON de queries

#### Sync manual
- Planta debe estar `ready_to_sync`
- Rango permitido limitado
- No permitir múltiples jobs `running` para la misma planta
- Aplicar cooldown básico para evitar spam manual

---

### 7.5 Lógica analítica mínima

#### Underperformance MVP
Usar una lógica simple, reproducible y estable para el último timestamp:
- calcular potencia de referencia por `peer_group` o agrupación equivalente,
- calcular `underperf_ratio = p_string / p_ref_group`,
- clasificar:
  - `green`: `>= 0.95`
  - `yellow`: `>= 0.80` y `< 0.95`
  - `red`: `< 0.80`
  - `gray`: sin dato suficiente

#### Importante
- No buscar todavía paridad total con Power BI.
- La meta es una base funcional y validable.
- La paridad fina con DAX y fórmulas avanzadas irá en ticket posterior.

---

## 8) Estructura Feature-First esperada

```txt
src/
  app/
    (auth)/
      login/page.tsx
    (app)/
      dashboard/page.tsx
      plants/page.tsx
      plants/new/page.tsx
      plants/[plantId]/page.tsx
      plants/[plantId]/settings/page.tsx
      plants/[plantId]/ingestion/page.tsx
      plants/[plantId]/heatmap/page.tsx
      plants/[plantId]/strings/[stringId]/page.tsx
  features/
    auth/
    plants/
    ingestion/
    dashboard/
    heatmap/
    shared/
  actions/
    auth.ts
    plants.ts
    ingestion.ts
    dashboard.ts
```

### Nota
- Mantener `shared/` para utilidades realmente reutilizables.
- Evitar crear features futuras que no se usarán en este ticket.

---

## 9) Fases de entrega

### Fase 0 — Setup y blindaje

#### Entregables
- Proyecto base corriendo con pnpm
- `env.ts` validando variables
- Auth middleware
- Security headers
- Estructura feature-first mínima
- Migración inicial con `organizations` y `org_members` + RLS

#### Validación
- build, lint y typecheck en verde
- login protegido por middleware
- usuario nuevo crea org + owner membership

### Fase 1 — Onboarding de planta

#### Entregables
- CRUD de planta
- Upload de `Trackers.csv`
- Upload de SVG
- Configuración GPM cifrada
- Checklist de onboarding visible

#### Validación
- planta puede quedar `ready_to_sync`
- archivos se validan y persisten
- mismatch crítico bloquea avance

### Fase 2 — Ingestión manual

#### Entregables
- `ingestion_jobs`
- trigger manual
- descarga/parsing GPM
- ETL TypeScript MVP
- UPSERT `fact_string`
- vista de historial de jobs

#### Validación
- ejecutar sync para ANGAMOS
- job cambia de estados correctamente
- `fact_string` queda poblada

### Fase 3 — Dashboard operativo mínimo

#### Entregables
- KPI cards
- tabla de strings último timestamp
- detalle simple por string
- heatmap SVG mínimo

#### Validación
- operador puede detectar strings rojos
- click en heatmap abre detalle
- datos del dashboard coinciden con la última sync

---

## 10) Riesgos y blindajes

### Riesgo 1 — Ticket demasiado grande
**Blindaje:** este ticket no incluye billing, team, API pública, soiling ni automatización.

### Riesgo 2 — Claude Code intenta sobrearquitectura
**Blindaje:** prohibido crear features futuras no usadas por el MVP. No generar tablas ni rutas de fases futuras.

### Riesgo 3 — RLS compleja en tablas de alto volumen
**Blindaje:** todas las tablas de dominio incluyen `org_id` explícito.

### Riesgo 4 — Sync concurrente rompe consistencia
**Blindaje:** máximo un job `running` por planta.

### Riesgo 5 — Archivo SVG y trackers no matchean
**Blindaje:** validación de consistencia antes de habilitar sync.

### Riesgo 6 — GPM y ETL absorben todo el esfuerzo
**Blindaje:** limitar el soporte inicial al set mínimo de queries y al caso ANGAMOS.

### Riesgo 7 — Performance prematuro
**Blindaje:** sin particionado en este ticket; primero medir con índices y dataset real.

### Riesgo 8 — Duplicación API + Server Actions
**Blindaje:** usar Server Actions como camino principal del app.

---

## 11) Checklist técnico para Claude Code

- [ ] Inicializar proyecto sobre jona-conveyor usando pnpm
- [ ] Crear `src/lib/env.ts` con validación Zod
- [ ] Configurar security headers en `next.config.ts`
- [ ] Implementar auth con Supabase
- [ ] Implementar bootstrap de `organization` + owner membership
- [ ] Crear helpers `requireAuth`, `requireOrg`, `requireRole`
- [ ] Crear migración inicial con:
  - [ ] `organizations`
  - [ ] `org_members`
  - [ ] `plants`
  - [ ] `plant_integrations`
  - [ ] `dim_trackers`
  - [ ] `svg_layout`
  - [ ] `fact_string`
  - [ ] `ingestion_jobs`
- [ ] Activar RLS en la misma migración de cada tabla
- [ ] Crear índices mínimos para consultas por `org_id`, `plant_id`, `ts_local`, `string_id`
- [ ] Implementar feature `plants` con formularios y validaciones Zod
- [ ] Implementar upload/parse de `Trackers.csv`
- [ ] Implementar upload/parse de SVG
- [ ] Implementar persistencia cifrada de credenciales GPM
- [ ] Implementar `ingestion_jobs` + estado en UI
- [ ] Portar ETL mínima a TypeScript usando el documento maestro como referencia
- [ ] Implementar trigger manual de sync con rate limit
- [ ] Implementar dashboard de planta
- [ ] Implementar tabla de strings del último timestamp
- [ ] Implementar heatmap SVG mínimo
- [ ] Implementar página detalle simple por string
- [ ] Agregar tests unitarios críticos de parsing y clasificación
- [ ] Agregar e2e para login, crear planta, cargar archivos, sync, dashboard y heatmap
- [ ] Verificar `pnpm exec tsc --noEmit`, `pnpm run build`, `pnpm run lint`

---

## 12) Criterios de aceptación

### Happy path
- [ ] Un usuario nuevo puede registrarse y queda asociado a una organization owner.
- [ ] Puede crear una planta y guardar sus datos base.
- [ ] Puede cargar `Trackers.csv` y SVG válidos.
- [ ] Puede configurar credenciales y query IDs GPM.
- [ ] La planta queda en estado `ready_to_sync` cuando cumple condiciones.
- [ ] Puede lanzar una sync manual.
- [ ] El job muestra estado y resultado.
- [ ] La tabla `fact_string` queda poblada para el rango procesado.
- [ ] El dashboard muestra KPIs y tabla de strings.
- [ ] El heatmap renderiza el SVG y colorea strings según clasificación.
- [ ] Hacer click en un string muestra detalle.
- [ ] Un usuario de otra org no puede leer ni modificar datos ajenos.

### Casos borde
- [ ] Si el SVG es inválido, el sistema rechaza la carga con mensaje claro.
- [ ] Si `Trackers.csv` no tiene columnas mínimas, el sistema rechaza la carga.
- [ ] Si las credenciales GPM fallan, el job termina en error sin exponer secretos.
- [ ] Si ya existe un job `running` para la planta, no se puede lanzar otro.
- [ ] Si no hay datos válidos para el rango, el job termina en `partial` o error controlado.

---

## 13) Plan de pruebas

### Unit tests
- parser de `Trackers.csv`
- parser de SVG ids
- validación de config GPM
- cálculo de `underperf_ratio`
- clasificación `green/yellow/red/gray`
- guardado/cifrado de credenciales

### Integration tests
- bootstrap auth -> organization
- create/update plant
- onboarding status transitions
- create job -> process job -> upsert `fact_string`

### E2E
- login
- crear planta
- subir `Trackers.csv`
- subir SVG
- configurar GPM
- ejecutar sync manual
- abrir dashboard
- abrir heatmap y seleccionar string

### Smoke checks obligatorios
- `pnpm exec tsc --noEmit`
- `pnpm run build`
- `pnpm run lint`

---

## 14) Notas de implementación SaaS Factory

- Feature-First estricto.
- No usar `any`.
- No usar `as` para datos externos; usar Zod parse.
- Una idea = un commit.
- No agregar tablas o servicios de fases futuras.
- No crear REST interna si Server Actions resuelve el caso.
- RLS en misma migración que la tabla.
- No hardcodear secrets.
- No implementar Stripe, API pública, Huawei ni soiling completo en este ticket.

---

# PRP/Ticket para Claude Code

## Título
Implementar el Foundation MVP de Sundled para onboarding de planta, sync manual GPM, dashboard operativo y heatmap mínimo, siguiendo Golden Path y Feature-First.

## Contexto
Se necesita una base SaaS usable para el primer caso real (ANGAMOS). El objetivo no es construir toda la plataforma completa, sino dejar una versión robusta que permita autenticar usuarios, aislar organizaciones, crear una planta, cargar sus archivos de configuración, ejecutar una sincronización manual desde GPM y visualizar datos string-level en dashboard y heatmap.

## Referencia base
Usar `docs/context/sundled-master-spec.md` como documento fuente de contexto y decisiones previas. Este ticket manda sobre el alcance del MVP si hay conflicto entre visión amplia y ejecución actual.

## Objetivo
Entregar un MVP funcional, validable y seguro que reemplace el flujo manual actual para onboarding y diagnóstico básico de una planta FV en Sundled.

## Alcance
- Auth con Supabase
- Bootstrap de organization + owner membership
- CRUD de planta
- Upload de `Trackers.csv`
- Upload de SVG layout
- Configuración GPM cifrada
- Sync manual GPM
- ETL TypeScript MVP a `fact_string`
- Historial de jobs
- Dashboard mínimo
- Heatmap SVG mínimo
- RLS + validaciones + security headers + env validation + rate limiting

## No alcance
- Billing / Stripe
- Team invites
- API pública
- Huawei
- Soiling completo
- Alertas por email/webhook
- Schedules automáticos
- PWA / mobile / offline
- Reportes PDF
- Analytics avanzados

## UX/Flows
- Login -> dashboard vacío -> crear planta
- Crear planta -> subir `Trackers.csv` + SVG -> configurar GPM -> `ready_to_sync`
- Ejecutar sync manual -> ver estado job -> abrir dashboard
- Dashboard -> tabla de strings -> heatmap -> detalle de string

## Modelo de datos
Implementar estas tablas en Supabase con `org_id` explícito en dominio y operación:
- `organizations`
- `org_members`
- `plants`
- `plant_integrations`
- `dim_trackers`
- `svg_layout`
- `fact_string`
- `ingestion_jobs`

No implementar tablas de billing, alerts ni soiling todavía.

## Seguridad/RLS
- RLS en la misma migración que crea cada tabla
- Aislamiento por `org_id` + `org_members`
- Roles `owner/admin/operator/viewer`
- Credenciales GPM cifradas con AES-256-GCM
- No exponer secrets en logs
- Security headers en `next.config.ts`
- `env.ts` con Zod
- Rate limit en trigger manual de sync

## Validaciones
- Zod en formularios, uploads y Server Actions
- `Trackers.csv` y SVG con validación estructural
- Query IDs mínimos obligatorios para GPM
- Planta debe estar `ready_to_sync` antes de sync
- Un solo job `running` por planta

## Tareas técnicas
- Setup proyecto y blindajes base
- Migraciones y RLS
- Auth + org bootstrap
- Feature `plants`
- Upload/parse `Trackers.csv`
- Upload/parse SVG
- Integración GPM cifrada
- `ingestion_jobs` + trigger manual
- Port ETL mínima desde documento maestro
- Dashboard + tabla último timestamp
- Heatmap mínimo
- Tests unit, integration y e2e

## Criterios de aceptación
- Usuario nuevo queda con organization owner
- Puede crear planta y dejarla `ready_to_sync`
- Puede ejecutar sync manual GPM
- Se persiste `fact_string`
- Dashboard muestra datos de la última sync
- Heatmap renderiza y colorea strings
- Click en string abre detalle
- RLS bloquea acceso cross-tenant
- build/lint/typecheck en verde

## Plan de pruebas
- Unit tests de parsing y clasificación
- Integration tests de onboarding y sync
- E2E de login -> create plant -> upload files -> sync -> dashboard -> heatmap
- Smoke: build, lint y typecheck

## Notas de implementación
- No sobrearquitecturar
- No crear features futuras en este ticket
- Server Actions como camino principal
- Feature-First estricto
- pnpm obligatorio
- No `any`
- No `as` para datos externos

## Riesgos y blindajes
- Evitar que Claude Code agregue billing, soiling o Huawei por adelantado
- Evitar tablas sin `org_id` en dominio de alto volumen
- Evitar RLS tardía
- Evitar particionado prematuro
- Evitar duplicar API REST interna y Server Actions
