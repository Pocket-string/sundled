# TICKET-001: Sundled — SaaS de Monitoreo Fotovoltaico

> **Tipo**: Epic / Requerimiento Fundacional
> **Prioridad**: Critica
> **Autor**: Arquitectura Sundled
> **Fecha**: 2026-03-07
> **Estado**: Draft
> **Base template**: [jona-conveyor](https://github.com/Pocket-string/jona-conveyor)
> **Package manager**: pnpm (PROHIBIDO npm)

---

## 1. Vision del Producto

### 1.1 Que es Sundled

Sundled es una plataforma SaaS de monitoreo fotovoltaico a nivel de string que permite a operadores de plantas solares detectar bajo-rendimiento, calcular perdidas por soiling, y optimizar la limpieza de paneles mediante analisis ROI automatizado.

### 1.2 Problema que Resuelve

| Problema actual | Solucion Sundled |
|---|---|
| Datos fragmentados en portales (GPM, FusionSolar) | Ingestion automatizada centralizada |
| Analisis manual en Power BI con DAX | Dashboards web nativos en tiempo real |
| Deteccion de fallos lenta (MTTD alto) | Alertas automaticas por umbral de rendimiento |
| Sin calculo de ROI para limpieza | Motor de soiling con recomendaciones economicas |
| SVGs estaticos desconectados de datos | Heatmap interactivo sincronizado con data grid |
| Sin multi-tenancy | Plataforma multi-cliente con pricing por string |

### 1.3 Usuarios Objetivo

| Rol | Necesidad principal |
|---|---|
| Coordinador O&M | Priorizar cuadrillas por fallo de strings |
| Tecnico de campo | Navegar a string problematico en < 30s |
| Gerencia | KPIs de PR, MTTD, MTTR, perdidas evitables |
| Propietario de planta | ROI de limpieza y reporte de rendimiento |

### 1.4 Metricas de Exito

- **MTTD** (Mean Time To Detect): < 30 minutos desde ingestion
- **Navegacion a string**: < 30 segundos en heatmap
- **Precision de deteccion**: F1 >= 0.85 en underperformance
- **Disponibilidad dashboard**: 99.5% uptime

---

## 2. Arquitectura del Sistema

### 2.1 Stack Tecnologico (Golden Path)

| Capa | Tecnologia | Justificacion |
|---|---|---|
| Framework | Next.js 16 + React 19 + TypeScript 5.7 | Full-stack unificado, Turbopack |
| Styling | Tailwind CSS 3.4 + shadcn/ui | Utility-first, componentes accesibles |
| Base de datos | Supabase PostgreSQL | RLS nativo, Auth integrado, Realtime |
| Auth | Supabase Auth | Email/password, OAuth, MFA ready |
| State | Zustand 5 + Immer | Inmutabilidad con Map/Set support |
| Validacion | Zod | Runtime + compile-time safety |
| Charts | Recharts + D3-scale + D3-chromatic | Heatmaps, time series, legends |
| Email | Resend | Transactional emails |
| Background jobs | Supabase Edge Functions + pg_cron | Scraping programado |
| Scraping | Playwright (via Edge Function o worker) | Browser automation |
| Testing | Playwright E2E + Vitest unit | Cobertura completa |
| Deploy | Vercel (frontend) + Supabase (backend) | Zero-config, auto-scaling |
| Package manager | **pnpm** | OBLIGATORIO. npm PROHIBIDO |

### 2.2 Diagrama de Arquitectura

```
                         SUNDLED ARCHITECTURE

  +------------------+     +------------------+     +------------------+
  |   Portal GPM     |     |  Portal Huawei   |     |   Open-Meteo     |
  |  (greenpowermon) |     |  (fusionsolar)   |     |   Weather API    |
  +--------+---------+     +--------+---------+     +--------+---------+
           |                         |                        |
           v                         v                        v
  +--------+---------+     +--------+---------+     +--------+---------+
  | Scraper Adapter  |     | Scraper Adapter  |     |  Weather Client  |
  |   (GPM v3 port)  |     | (Huawei v1 port) |     |  (Open-Meteo)    |
  +--------+---------+     +--------+---------+     +--------+---------+
           |                         |                        |
           +------------+------------+------------------------+
                        |
                        v
           +------------+------------+
           |     INGESTION QUEUE     |
           |  (Supabase Edge Func +  |
           |   pg_cron scheduler)    |
           +------------+------------+
                        |
                        v
           +------------+------------+
           |      ETL PIPELINE       |
           |  (TypeScript port of    |
           |   loader.py logic)      |
           |  - Unpivot/Melt         |
           |  - Regex ID extraction  |
           |  - I+V merge, P=IxV     |
           |  - POA aggregation      |
           |  - Inverter resolution  |
           |  - Fan-out validation   |
           +------------+------------+
                        |
                        v
  +-----------------------------------------------------+
  |              SUPABASE POSTGRESQL                      |
  |                                                       |
  |  Schema: sundled                                      |
  |  +-------------+  +-------------+  +-------------+   |
  |  | fact_string  |  |dim_trackers |  |  dim_date   |   |
  |  | (time-series)|  | (693+/plant)|  | (48/day)    |   |
  |  +------+------+  +------+------+  +------+------+   |
  |         |                |                |           |
  |  +------+------+  +------+------+  +------+------+   |
  |  | svg_layout   |  |   plants   |  |   users     |   |
  |  | (geometry)   |  | (tenants)  |  | (auth)      |   |
  |  +-------------+  +-------------+  +-------------+   |
  |                                                       |
  |  RLS: Todas las tablas filtradas por org_id           |
  +-----------------------------------------------------+
                        |
          +-------------+-------------+
          |                           |
          v                           v
  +-------+--------+       +---------+--------+
  |   ANALYTICS     |       |   NOTIFICATIONS  |
  |   ENGINE        |       |   SERVICE        |
  |                 |       |                  |
  | - P_expected    |       | - Email (Resend) |
  |   (P75 at POA)  |       | - In-app alerts  |
  | - Underperf%    |       | - Webhook        |
  | - Soiling loss  |       | - Cooldown 24h   |
  | - Break-even    |       |                  |
  | - Cleaning ROI  |       |                  |
  +-------+--------+       +------------------+
          |
          v
  +-------+------------------------------------------+
  |              NEXT.JS FRONTEND                     |
  |                                                   |
  |  /dashboard ........ KPIs + time series           |
  |  /plants/[id] ...... Plant detail + readings      |
  |  /plants/[id]/heatmap  SVG heatmap interactivo    |
  |  /plants/[id]/soiling  Calculadora soiling        |
  |  /settings ......... Config + integraciones       |
  |  /billing .......... Planes + uso de strings      |
  |  /team ............. Gestion de equipo            |
  +---------------------------------------------------+
```

---

## 3. Esquema de Base de Datos

### 3.1 Tablas de Plataforma (Multi-tenant)

#### `organizations`
```sql
CREATE TABLE sundled.organizations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  plan_id        UUID REFERENCES sundled.plans(id),
  string_quota   INTEGER NOT NULL DEFAULT 0,         -- strings contratados
  string_used    INTEGER NOT NULL DEFAULT 0,         -- strings activos
  billing_email  TEXT,
  stripe_customer_id TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
```

#### `org_members`
```sql
CREATE TABLE sundled.org_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES sundled.organizations(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           TEXT NOT NULL DEFAULT 'viewer'
                 CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  invited_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);
```

#### `plans` (Pricing por string)
```sql
CREATE TABLE sundled.plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,                       -- 'starter', 'professional', 'enterprise'
  price_per_string_monthly NUMERIC NOT NULL,          -- USD/string/mes
  min_strings    INTEGER NOT NULL DEFAULT 1,
  max_strings    INTEGER,                             -- NULL = unlimited
  features       JSONB NOT NULL DEFAULT '{}',         -- feature flags
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Seed data
INSERT INTO sundled.plans (name, price_per_string_monthly, min_strings, max_strings, features) VALUES
  ('starter',      0.50, 1,    100,  '{"history_days": 30,  "alerts": true,  "soiling": false, "api": false,  "team_members": 2}'),
  ('professional', 0.35, 101,  500,  '{"history_days": 90,  "alerts": true,  "soiling": true,  "api": true,   "team_members": 10}'),
  ('enterprise',   0.20, 501,  NULL, '{"history_days": 365, "alerts": true,  "soiling": true,  "api": true,   "team_members": -1}');
```

### 3.2 Tablas de Dominio (Plantas y Configuracion)

#### `plants`
```sql
CREATE TABLE sundled.plants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES sundled.organizations(id) ON DELETE CASCADE,

  -- Identity
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,
  timezone       TEXT NOT NULL DEFAULT 'America/Santiago',

  -- Location
  lat            NUMERIC NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon            NUMERIC NOT NULL CHECK (lon BETWEEN -180 AND 360),

  -- Topology
  ct_count       INTEGER NOT NULL DEFAULT 1,          -- centros de transformacion
  inverter_count INTEGER NOT NULL DEFAULT 0,
  string_count   INTEGER NOT NULL DEFAULT 0,          -- billable metric

  -- Panel specs
  module_power_w NUMERIC CHECK (module_power_w > 0),
  total_dc_kw    NUMERIC CHECK (total_dc_kw > 0),
  tilt_deg       NUMERIC CHECK (tilt_deg BETWEEN 0 AND 90),
  azimuth_deg    NUMERIC CHECK (azimuth_deg BETWEEN 0 AND 360),

  -- Thermal
  noct           NUMERIC DEFAULT 45.0,
  temp_coeff     NUMERIC DEFAULT -0.35,               -- %/degC

  -- Economics
  energy_price   NUMERIC NOT NULL CHECK (energy_price > 0),
  cleaning_cost  NUMERIC NOT NULL CHECK (cleaning_cost > 0),
  currency       TEXT DEFAULT 'USD' CHECK (currency IN ('USD','EUR','CLP','GBP','MXN','BRL')),

  -- Data source
  portal_type    TEXT CHECK (portal_type IN ('gpm', 'huawei', 'manual', 'api')),
  portal_config  JSONB DEFAULT '{}',                  -- encrypted credentials reference

  -- SVG
  svg_layout_url TEXT,                                -- URL to uploaded SVG

  -- Status
  is_active      BOOLEAN DEFAULT true,
  last_sync_at   TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success','partial','error')),

  -- Audit
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),

  UNIQUE(org_id, slug)
);
```

#### `portal_credentials` (Encrypted)
```sql
CREATE TABLE sundled.portal_credentials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id            UUID NOT NULL REFERENCES sundled.plants(id) ON DELETE CASCADE,
  portal_type         TEXT NOT NULL CHECK (portal_type IN ('gpm', 'huawei')),

  -- AES-256-GCM encrypted
  credentials_encrypted TEXT NOT NULL,
  credentials_iv        TEXT NOT NULL,
  credentials_tag       TEXT NOT NULL,

  -- GPM specific
  query_ids           JSONB,                          -- {"I_Strings_CT1": 402244, ...}

  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now(),

  UNIQUE(plant_id)
);
```

### 3.3 Tablas de Data Warehouse (Star Schema)

#### `dim_trackers`
```sql
CREATE TABLE sundled.dim_trackers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id       UUID NOT NULL REFERENCES sundled.plants(id) ON DELETE CASCADE,

  ct_id          TEXT NOT NULL,
  inverter_id    TEXT NOT NULL,
  inverter_base  TEXT NOT NULL,
  tracker_id     TEXT NOT NULL,
  string_label   TEXT NOT NULL,
  tracker_n      INTEGER,
  string_n       INTEGER,
  dc_in          INTEGER NOT NULL,
  module         TEXT,

  -- Computed keys
  string_id      TEXT NOT NULL,                       -- "CT1-INV 1-1-TRK1-S1"
  svg_id         TEXT NOT NULL,                       -- "CT1_INV1-1_TRK1_S1"
  inverter_dc_key TEXT NOT NULL,                      -- "INV 1-1|1"
  peer_group     TEXT,                                -- "2x540"

  inserted_at    TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),

  UNIQUE(plant_id, string_id)
);

CREATE INDEX ix_dim_trackers_invdc ON sundled.dim_trackers (plant_id, inverter_id, dc_in);
CREATE INDEX ix_dim_trackers_svg ON sundled.dim_trackers (plant_id, svg_id);
```

#### `dim_date`
```sql
CREATE TABLE sundled.dim_date (
  plant_id       UUID NOT NULL REFERENCES sundled.plants(id) ON DELETE CASCADE,
  ts_local       TIMESTAMP NOT NULL,
  ts_utc         TIMESTAMPTZ NOT NULL,
  date_val       DATE NOT NULL,
  year_val       INTEGER NOT NULL,
  month_no       INTEGER NOT NULL,
  month_name     TEXT NOT NULL,
  day_val        INTEGER NOT NULL,
  day_name       TEXT NOT NULL,
  hour_val       INTEGER NOT NULL,
  minute_val     INTEGER NOT NULL,
  half_hour      TEXT NOT NULL,                       -- "HH:MM"

  PRIMARY KEY (plant_id, ts_local)
);
```

#### `fact_string`
```sql
CREATE TABLE sundled.fact_string (
  plant_id       UUID NOT NULL REFERENCES sundled.plants(id) ON DELETE CASCADE,
  fecha          TIMESTAMP NOT NULL,
  ts_utc         TIMESTAMPTZ,

  -- Dimensional
  string_id      TEXT NOT NULL,
  svg_id         TEXT,
  inverter_id    TEXT,
  inverter_dc_key TEXT,
  dc_in          INTEGER,
  module         TEXT,
  peer_group     TEXT,

  -- Measures
  i_string       DOUBLE PRECISION,                    -- Current (A)
  v_string       DOUBLE PRECISION,                    -- Voltage (V)
  p_string       DOUBLE PRECISION,                    -- Power (W) = I * V
  poa            DOUBLE PRECISION,                    -- Irradiance (W/m2)
  t_mod          DOUBLE PRECISION,                    -- Temperature (degC)

  -- Audit
  inserted_at    TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (plant_id, fecha, string_id)
);

-- Partitioning by month (performance at scale)
-- Implementation: declarative partitioning on plant_id + fecha range
```

#### `svg_layout`
```sql
CREATE TABLE sundled.svg_layout (
  plant_id       UUID NOT NULL REFERENCES sundled.plants(id) ON DELETE CASCADE,
  svg_id         TEXT NOT NULL,
  tag            TEXT,
  css_class      TEXT,
  title          TEXT,
  x              DOUBLE PRECISION,
  y              DOUBLE PRECISION,
  width          DOUBLE PRECISION,
  height         DOUBLE PRECISION,
  string_id_guess TEXT,
  tracker_id_guess TEXT,

  PRIMARY KEY (plant_id, svg_id)
);
```

### 3.4 Tablas de Soiling y Limpieza

#### `production_readings`
```sql
CREATE TABLE sundled.production_readings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id       UUID NOT NULL REFERENCES sundled.plants(id) ON DELETE CASCADE,
  reading_date   DATE NOT NULL,

  -- Input
  real_kwh       NUMERIC NOT NULL CHECK (real_kwh >= 0),

  -- Calculated (soiling_service.py logic)
  theoretical_kwh    NUMERIC DEFAULT 0,
  loss_kwh           NUMERIC DEFAULT 0,
  loss_pct           NUMERIC DEFAULT 0,
  loss_value         NUMERIC DEFAULT 0,
  soiling_loss_pct   NUMERIC DEFAULT 0,
  pr                 NUMERIC DEFAULT 0,               -- Performance Ratio
  pr_clean_baseline  NUMERIC,                         -- PR at last cleaning
  accumulated_loss   NUMERIC DEFAULT 0,

  -- Recommendation
  recommendation     TEXT CHECK (recommendation IN ('OK','WATCH','RECOMMENDED','URGENT')),
  break_even_days    NUMERIC,

  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plant_id, reading_date)
);
```

#### `cleaning_events`
```sql
CREATE TABLE sundled.cleaning_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id       UUID NOT NULL REFERENCES sundled.plants(id) ON DELETE CASCADE,
  cleaning_date  DATE NOT NULL,
  notes          TEXT,
  energy_recovered_kwh NUMERIC,
  cleaning_value NUMERIC,
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

### 3.5 Tablas de Ingestion y Jobs

#### `ingestion_jobs`
```sql
CREATE TABLE sundled.ingestion_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id       UUID NOT NULL REFERENCES sundled.plants(id) ON DELETE CASCADE,

  -- Scheduling
  job_type       TEXT NOT NULL CHECK (job_type IN ('scheduled', 'on_demand')),
  cron_expression TEXT,                               -- "0 4 * * *" = daily 4am

  -- Execution state
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','running','success','partial','error','cancelled')),
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,

  -- Parameters
  date_start     DATE NOT NULL,
  date_end       DATE NOT NULL,
  queries        JSONB,                               -- ["I_Strings_CT1", "V_String_CT1", "POA"]

  -- Results
  records_loaded INTEGER DEFAULT 0,
  records_expected INTEGER,
  error_message  TEXT,
  manifest       JSONB,                               -- download manifest per-query

  -- Retry
  attempt        INTEGER DEFAULT 1,
  max_attempts   INTEGER DEFAULT 3,
  next_retry_at  TIMESTAMPTZ,

  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_jobs_plant_status ON sundled.ingestion_jobs (plant_id, status);
CREATE INDEX ix_jobs_next_retry ON sundled.ingestion_jobs (next_retry_at) WHERE status = 'error';
```

#### `ingestion_schedules`
```sql
CREATE TABLE sundled.ingestion_schedules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id       UUID NOT NULL REFERENCES sundled.plants(id) ON DELETE CASCADE,
  is_enabled     BOOLEAN DEFAULT true,
  cron_expression TEXT NOT NULL DEFAULT '0 4 * * *',  -- daily 4am local
  queries        JSONB NOT NULL,                      -- queries to download
  last_run_at    TIMESTAMPTZ,
  next_run_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plant_id)
);
```

### 3.6 Tablas de Alertas

#### `alert_rules`
```sql
CREATE TABLE sundled.alert_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id       UUID NOT NULL REFERENCES sundled.plants(id) ON DELETE CASCADE,

  metric         TEXT NOT NULL CHECK (metric IN ('underperf_pct','soiling_loss_pct','poa','i_string','v_string')),
  operator       TEXT NOT NULL CHECK (operator IN ('<','>','<=','>=','==')),
  threshold      NUMERIC NOT NULL,
  severity       TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),

  -- Notification
  notify_email   BOOLEAN DEFAULT true,
  notify_webhook BOOLEAN DEFAULT false,
  webhook_url    TEXT,
  cooldown_hours INTEGER DEFAULT 24,

  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

#### `alert_log`
```sql
CREATE TABLE sundled.alert_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id        UUID NOT NULL REFERENCES sundled.alert_rules(id) ON DELETE CASCADE,
  plant_id       UUID NOT NULL,

  triggered_value NUMERIC NOT NULL,
  severity       TEXT NOT NULL,
  message        TEXT NOT NULL,

  notified_at    TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),

  created_at     TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Modulos Feature-First (Fases de Desarrollo)

### 4.1 FASE 1 — MVP (Semanas 1-6)

Objetivo: Planta ANGAMOS operativa en Sundled con dashboard basico.

#### Feature: `src/features/auth/`
- Login/registro con Supabase Auth (email + password)
- Middleware de sesion SSR
- Creacion automatica de organization al registrarse
- Paginas: `/login`, `/register`, `/forgot-password`

#### Feature: `src/features/plants/`
- CRUD de plantas con formulario multi-step
- Upload de Trackers.csv para crear dim_trackers
- Upload de SVG layout para crear svg_layout
- Configuracion de portal (GPM credentials encrypted)
- Paginas: `/plants`, `/plants/new`, `/plants/[id]`, `/plants/[id]/settings`

#### Feature: `src/features/ingestion/`
- Trigger manual de descarga (boton "Sync Now")
- Puerto del pipeline ETL de `loader.py` a TypeScript:
  - `parseScadaCsv()`: Lee CSV con separator `;`, encoding UTF-8-SIG
  - `unpivotColumns()`: Melt de columnas anchas a filas largas
  - `extractInverterId()`: Regex `^(INV\s*\d+(?:-\d+)?)`
  - `extractDcIn()`: Regex `DC\s*IN\s*(\d+)`
  - `mergeCurrentVoltage()`: Outer join por (fecha, ct_id, inverter_id, dc_in)
  - `calculatePower()`: `P = I * V`
  - `processPoaDualSensor()`: Validacion ratio <= 1.30, promedio si OK, max si excede
  - `resamplePoa()`: 5min -> 30min con media
  - `resolveInverterIds()`: Resolucion ambigua solo si (ct_id, base, dc_in) es unico
  - `validateFanOut()`: Alerta si observado > 1.2x esperado
  - `upsertFactString()`: INSERT ON CONFLICT (plant_id, fecha, string_id) DO UPDATE
- Estado del job visible en UI
- Paginas: `/plants/[id]/ingestion`

#### Feature: `src/features/dashboard/`
- KPI cards: PR promedio, strings activos, ultima sincronizacion, perdida total
- Time series chart (Recharts): I, V, P por string seleccionado
- Tabla de strings con filtro por CT/inversor/tracker
- Paginas: `/dashboard`, `/plants/[id]/dashboard`

#### Infraestructura Fase 1
- Schema de BD sundled (migraciones Supabase)
- RLS en todas las tablas filtrado por org_id
- Middleware Next.js para auth + org context
- Layout compartido con sidebar navigation
- Configuracion de pnpm workspace

---

### 4.2 FASE 2 — Visualizacion Avanzada (Semanas 7-10)

#### Feature: `src/features/heatmap/`

Puerto del **SVG Dashboard (Zonelizer + Planta)** a componentes React:

**Motor de analitica (reemplaza DAX de Power BI):**

```typescript
// src/features/heatmap/lib/analytics-engine.ts

/**
 * P_expected: Percentil 75 de potencia historica a POA similar
 * Fuente: GEMINI.md DAX measure "P_expected (p75, ventana 30d a POA similar)"
 */
function computePExpected(
  stringId: string,
  currentPoa: number,
  history: FactString[],
  poaTolerance: number = 50  // W/m2
): number {
  const similar = history.filter(
    r => r.string_id === stringId &&
         Math.abs(r.poa - currentPoa) < poaTolerance
  );
  return percentile(similar.map(r => r.p_string), 0.75);
}

/**
 * Underperf%: Ratio real vs esperado
 * Fuente: GEMINI.md "Underperf % = DIVIDE([P_string], [P_expected])"
 */
function computeUnderperf(pActual: number, pExpected: number): number {
  return pExpected > 0 ? pActual / pExpected : 0;
}

/**
 * Clasificacion semaforo
 * Fuente: GEMINI.md "Class (semaforizacion)"
 * green >= 0.95, yellow >= 0.80, red < 0.80, gray = null
 */
function classifyString(underperf: number | null): 'green' | 'yellow' | 'red' | 'gray' {
  if (underperf === null) return 'gray';
  if (underperf >= 0.95) return 'green';
  if (underperf >= 0.80) return 'yellow';
  return 'red';
}
```

**Heatmap SVG interactivo (puerto de Zonelizer v2):**

```typescript
// src/features/heatmap/components/svg-heatmap.tsx
// Basado en: Zonelizer/components/v2/SvgEditor.tsx

// Patron: Event delegation (1 listener para N elementos)
// Color pipeline: values -> getDomain() -> getColorScale() -> hex -> fill
// Palettes: viridis, plasma, inferno, turbo (d3-chromatic)
// Scales: linear, quantile, log (d3-scale)
// Interaccion: click=select, shift+click=multiselect, hover=tooltip
```

**Data Grid sincronizado (puerto de Zonelizer DataGrid):**

```typescript
// src/features/heatmap/components/string-data-grid.tsx
// Basado en: Zonelizer/components/v2/DataGrid.tsx

// Columnas: string_id, inverter, tracker, I, V, P, POA, underperf%, class
// Editable: NO (read-only en SaaS)
// Seleccion bidireccional: click en grid <-> highlight en SVG
// Filtros: por CT, inversor, tracker, severity (green/yellow/red)
// Export: CSV download
```

**Store del heatmap (patron Zustand + Immer de Zonelizer):**

```typescript
// src/features/heatmap/store/heatmap-store.ts
// Basado en: Zonelizer/lib/v2/store.ts

interface HeatmapStore {
  svgString: string;
  elements: SvgElement[];         // parsed from SVG
  factData: FactStringRow[];      // latest readings
  selectedIds: Set<string>;
  colorConfig: {
    palette: 'viridis' | 'plasma' | 'inferno' | 'turbo';
    scaleType: 'linear' | 'quantile' | 'log';
    metric: 'underperf_pct' | 'i_string' | 'v_string' | 'p_string' | 'poa';
  };
  domain: [number, number] | null;
  // Actions
  loadSvg: (svg: string) => void;
  setFactData: (data: FactStringRow[]) => void;
  selectElement: (id: string, multi?: boolean) => void;
  setColorConfig: (config: Partial<ColorConfig>) => void;
}
```

- Paginas: `/plants/[id]/heatmap`

#### Feature: `src/features/soiling/`

Puerto del **Soiling Calculator** (soiling_service.py):

```typescript
// src/features/soiling/lib/soiling-engine.ts

/**
 * Soiling loss calculation
 * Fuente: soiling_service.py
 * Formula: soiling_loss_pct = (1 - current_pr / pr_clean_baseline) * 100
 */
function computeSoilingLoss(currentPr: number, prCleanBaseline: number): number {
  return (1 - currentPr / prCleanBaseline) * 100;
}

/**
 * Performance Ratio
 * PR = real_kwh / theoretical_kwh
 */
function computePR(realKwh: number, theoreticalKwh: number): number {
  return theoreticalKwh > 0 ? realKwh / theoreticalKwh : 0;
}

/**
 * Cell temperature via NOCT model
 * T_cell = T_amb + (NOCT - 20) * (POA / 800)
 */
function computeCellTemp(tAmb: number, noct: number, poa: number): number {
  return tAmb + (noct - 20) * (poa / 800);
}

/**
 * Temperature-adjusted power
 * P_adj = P_stc * (1 + temp_coeff * (T_cell - 25))
 */
function computeAdjustedPower(pStc: number, tempCoeff: number, tCell: number): number {
  return pStc * (1 + tempCoeff / 100 * (tCell - 25));
}

/**
 * Break-even analysis for cleaning ROI
 * days_to_clean = (cleaning_cost - accumulated_loss) / daily_loss_rate
 */
function computeBreakEven(cleaningCost: number, accumulatedLoss: number, dailyLossRate: number): number | null {
  return dailyLossRate > 0 ? (cleaningCost - accumulatedLoss) / dailyLossRate : null;
}

/**
 * 4-level cleaning recommendation
 * Fuente: soiling_service.py CleaningRecommendation
 */
function getCleaningRecommendation(
  soilingPct: number,
  accumulatedLoss: number,
  cleaningCost: number,
  breakEvenDays: number | null
): 'OK' | 'WATCH' | 'RECOMMENDED' | 'URGENT' {
  if (soilingPct >= 20 || (breakEvenDays !== null && breakEvenDays <= 0)) return 'URGENT';
  if (soilingPct >= 10 || accumulatedLoss >= cleaningCost * 0.8) return 'RECOMMENDED';
  if (soilingPct >= 5) return 'WATCH';
  return 'OK';
}
```

- Integracion con Open-Meteo API para datos meteorologicos
- Chart de tendencia soiling (Recharts area chart)
- Timeline de limpiezas con marcadores
- Paginas: `/plants/[id]/soiling`

#### Feature: `src/features/alerts/`
- CRUD de reglas de alerta por planta
- Motor de evaluacion post-ingestion
- Notificaciones email via Resend
- Log de alertas con acknowledge
- Cooldown de 24h por planta+regla
- Paginas: `/plants/[id]/alerts`

---

### 4.3 FASE 3 — Plataforma (Semanas 11-14)

#### Feature: `src/features/team/`
- Invitacion de miembros por email
- RBAC: owner, admin, operator, viewer
- Gestion de permisos por planta
- Paginas: `/team`, `/team/invite`

#### Feature: `src/features/billing/`
- Integracion Stripe (checkout, portal, webhooks)
- Pricing por string: tiers starter/professional/enterprise
- Medicion de uso: string_count por org
- Upgrade/downgrade con prorrataeo
- Paginas: `/billing`, `/billing/plans`

#### Feature: `src/features/api-keys/`
- Generacion de API keys (hash-based, scopes)
- REST API publica documentada
- Rate limiting por key
- Paginas: `/settings/api`

#### Feature: `src/features/integrations/`
- Configuracion de portales (GPM, Huawei)
- Schedule de ingestion con cron builder visual
- Status de sincronizacion en tiempo real
- Paginas: `/plants/[id]/integrations`

---

### 4.4 FASE 4 — Analytics Avanzado (Semanas 15+)

#### Feature: `src/features/reports/`
- Reportes PDF automaticos (semanal/mensual)
- Export de datos CSV/JSON
- Comparativa entre plantas

#### Feature: `src/features/analytics/`
- Prediccion de soiling (regresion lineal)
- Deteccion de anomalias (IQR method)
- Benchmark entre strings del mismo peer_group
- Degradacion historica de modulos

#### Feature: `src/features/mobile/`
- PWA responsive para tecnicos de campo
- Notificaciones push
- Modo offline con cache local

---

## 5. Arquitectura de Ingestion de Datos

### 5.1 Scraper Adapter Pattern

```typescript
// src/features/ingestion/lib/adapters/types.ts

interface ScraperAdapter {
  name: string;                                       // 'gpm' | 'huawei'
  login(credentials: PortalCredentials): Promise<SessionContext>;
  getPlantId(session: SessionContext): Promise<string>;
  downloadQuery(session: SessionContext, query: QueryConfig, dateRange: DateRange): Promise<DownloadResult>;
  validate(file: Buffer): ValidationReport;
}

interface DownloadResult {
  success: boolean;
  filePath: string | null;
  error: string | null;
  attempts: number;
  durationMs: number;
  fileSizeBytes: number;
}

interface QueryConfig {
  name: string;                                       // "I_Strings_CT1"
  id: string;                                         // "402244"
  type: 'current' | 'voltage' | 'irradiance';
}
```

### 5.2 GPM Adapter (Puerto de webscraper GPM v3.0)

```typescript
// src/features/ingestion/lib/adapters/gpm-adapter.ts
// Fuente: webscraper GPM v3.0/src/core/

// Autenticacion:
// URL: https://gpmportal.greenpowermonitor.com/application/login
// Selectores: input#username, input#password, #submit_show
// Sesion: detectar "Cerrar sesion" en DOM
// Plant ID: extraer del href del portfolio link

// Descarga:
// URL: /application/#/analysis/custom/{plantId}/table/{queryId}/{startIso}/{endIso}
// Boton: button:has-text(" Descargar")
// Captura: page.expect_download()

// Retry: max 3 intentos, backoff exponencial (2s, 4s, 8s)
// Validacion CSV: UTF-8-SIG, separator ";", headers "Medida"+"Fecha", min 10 rows
```

### 5.3 ETL Pipeline (Puerto de loader.py)

```typescript
// src/features/ingestion/lib/etl/pipeline.ts

async function processDay(plantId: string, date: Date, csvFiles: CsvFileSet): Promise<EtlResult> {
  // 1. Parse SCADA CSVs (I_Strings_CT*.csv, V_String_CT*.csv)
  const iData = await Promise.all(
    csvFiles.current.map(f => parseAndUnpivotScada(f, 'I_string'))
  );
  const vData = await Promise.all(
    csvFiles.voltage.map(f => parseAndUnpivotScada(f, 'V_string'))
  );

  // 2. Merge I + V (outer join by fecha, ct_id, inverter_id, dc_in)
  const merged = outerJoinIV(iData.flat(), vData.flat());

  // 3. Calculate power: P = I * V
  const withPower = merged.map(r => ({
    ...r,
    p_string: r.i_string != null && r.v_string != null ? r.i_string * r.v_string : null
  }));

  // 4. Process POA (dual sensor validation + 5min->30min resample)
  const poa = await processPoaFile(csvFiles.poa, date);

  // 5. Join with POA by fecha
  const withPoa = leftJoinPoa(withPower, poa);

  // 6. Load dim_trackers from DB
  const dimTrackers = await loadDimTrackers(plantId);

  // 7. Primary join: (ct_id, inverter_id, dc_in) -> string_id, svg_id
  let fact = joinWithDimTrackers(withPoa, dimTrackers);

  // 8. Fallback: resolve ambiguous inverter IDs
  const unresolved = fact.filter(r => r.string_id === null);
  if (unresolved.length > 0) {
    const resolved = resolveInverterIds(unresolved, dimTrackers);
    fact = mergeResolved(fact, resolved);
  }

  // 9. Fan-out validation
  const expected = dimTrackers.length * 48; // strings * intervals
  if (fact.length > expected * 1.2) {
    logger.warn(`Fan-out detected: ${fact.length} > ${expected * 1.2}`);
  }

  // 10. Timezone conversion (local -> UTC)
  const withTz = addTimezoneConversion(fact, plant.timezone);

  // 11. UPSERT to fact_string
  await upsertFactString(withTz);

  return { recordsLoaded: withTz.length, date };
}
```

### 5.4 Scheduling (pg_cron + Edge Functions)

```sql
-- Cron job que ejecuta procesamiento diario
SELECT cron.schedule(
  'sundled-daily-sync',
  '0 4 * * *',  -- 4:00 AM UTC
  $$
    SELECT sundled.trigger_daily_ingestion();
  $$
);
```

```typescript
// supabase/functions/trigger-ingestion/index.ts (Edge Function)
// 1. Lee ingestion_schedules donde next_run_at <= NOW()
// 2. Para cada schedule: crea ingestion_job con status 'pending'
// 3. Worker separado procesa jobs pendientes
```

---

## 6. Arquitectura de Visualizacion

### 6.1 Reemplazo de Power BI

| Componente Power BI | Reemplazo Sundled | Libreria |
|---|---|---|
| DAX P_expected (PERCENTILEX.INC) | `computePExpected()` TypeScript | Nativo |
| DAX Underperf% (DIVIDE) | `computeUnderperf()` TypeScript | Nativo |
| DAX Class (SWITCH) | `classifyString()` TypeScript | Nativo |
| Deneb rect heatmap | `<SvgHeatmap />` React component | D3 + SVG nativo |
| Power Query M unpivot | `parseAndUnpivotScada()` TypeScript | Papa Parse |
| Recharts equivalents | `<TimeSeriesChart />`, `<KpiCards />` | Recharts |

### 6.2 Color Pipeline

```
  fact_string data
       |
       v
  Extract metric values (p_string, underperf%, poa, etc.)
       |
       v
  getDomain([min, max]) -- from d3-array
       |
       v
  getColorScale(values, scaleType, palette) -- from d3-scale + d3-chromatic
       |
       v
  Map<string_id, hexColor>
       |
       v
  Apply to SVG: element.setAttribute('fill', color)
       |
       v
  Generate legend stops with getLegendStops()
```

### 6.3 Componentes de Visualizacion

```
src/features/heatmap/components/
  svg-heatmap.tsx          -- SVG renderer con event delegation
  string-data-grid.tsx     -- Tabla filtrable de strings
  color-legend.tsx         -- Leyenda con gradient stops
  color-palette-picker.tsx -- Selector de paleta y escala
  metric-selector.tsx      -- Dropdown de metrica (I, V, P, underperf%)
  time-slider.tsx          -- Selector de timestamp (48 intervalos)
  detail-panel.tsx         -- Panel lateral con datos del string seleccionado

src/features/dashboard/components/
  kpi-cards.tsx            -- PR, strings activos, ultima sync, perdida total
  time-series-chart.tsx    -- Line chart Recharts (I, V, P vs tiempo)
  plant-summary-table.tsx  -- Tabla resumen de plantas
  ingestion-status.tsx     -- Estado de sincronizacion en tiempo real

src/features/soiling/components/
  soiling-trend-chart.tsx  -- Area chart de tendencia soiling
  cleaning-timeline.tsx    -- Timeline de eventos de limpieza
  roi-calculator.tsx       -- Break-even visual
  recommendation-badge.tsx -- OK/WATCH/RECOMMENDED/URGENT badge
```

---

## 7. API Design

### 7.1 Endpoints REST

```
Authentication
  POST   /api/auth/login
  POST   /api/auth/register
  POST   /api/auth/forgot-password
  POST   /api/auth/logout

Plants
  GET    /api/plants                       -- lista de plantas (filtro org)
  POST   /api/plants                       -- crear planta
  GET    /api/plants/:id                   -- detalle planta
  PATCH  /api/plants/:id                   -- actualizar planta
  DELETE /api/plants/:id                   -- eliminar planta

Plant Configuration
  POST   /api/plants/:id/trackers          -- upload Trackers.csv
  POST   /api/plants/:id/svg-layout        -- upload SVG layout
  POST   /api/plants/:id/credentials       -- guardar credenciales portal

Ingestion
  POST   /api/plants/:id/sync              -- trigger manual
  GET    /api/plants/:id/jobs              -- historial de jobs
  GET    /api/plants/:id/jobs/:jobId       -- detalle job

Data (fact_string queries)
  GET    /api/plants/:id/strings           -- lista de strings con ultimo dato
  GET    /api/plants/:id/strings/:stringId -- detalle de string con historia
  GET    /api/plants/:id/readings          -- readings por rango de fechas
  GET    /api/plants/:id/heatmap-data      -- datos para heatmap (latest timestamp)

Analytics
  GET    /api/plants/:id/kpis              -- KPIs calculados
  GET    /api/plants/:id/underperformance  -- strings underperforming
  GET    /api/plants/:id/soiling           -- datos de soiling
  POST   /api/plants/:id/soiling/reading   -- registrar lectura de produccion
  GET    /api/plants/:id/cleaning-recommendation -- recomendacion actual

Alerts
  GET    /api/plants/:id/alerts            -- reglas configuradas
  POST   /api/plants/:id/alerts            -- crear regla
  PATCH  /api/plants/:id/alerts/:alertId   -- actualizar regla
  DELETE /api/plants/:id/alerts/:alertId   -- eliminar regla
  GET    /api/plants/:id/alert-log         -- historial de alertas

Team
  GET    /api/team                         -- miembros de la org
  POST   /api/team/invite                  -- invitar miembro
  PATCH  /api/team/:memberId               -- cambiar rol
  DELETE /api/team/:memberId               -- remover miembro

Billing
  GET    /api/billing/usage                -- uso actual (string count)
  GET    /api/billing/plans                -- planes disponibles
  POST   /api/billing/checkout             -- crear sesion Stripe
  POST   /api/billing/webhook              -- webhook de Stripe
```

### 7.2 Server Actions (Next.js)

```
src/actions/
  plants.ts         -- createPlant, updatePlant, deletePlant
  ingestion.ts      -- triggerSync, getJobStatus
  trackers.ts       -- uploadTrackers, uploadSvgLayout
  readings.ts       -- getFactStringData, getHeatmapData
  analytics.ts      -- computeKpis, getUnderperformance
  soiling.ts        -- addReading, getCleaningRecommendation
  alerts.ts         -- createRule, evaluateAlerts
  team.ts           -- inviteMember, changeRole
  billing.ts        -- getUsage, createCheckoutSession
```

---

## 8. Seguridad

### 8.1 Row-Level Security (RLS)

Todas las tablas filtradas por `org_id` via join a `org_members`:

```sql
-- Patron base para todas las tablas
CREATE POLICY "org_isolation" ON sundled.plants
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM sundled.org_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- Optimizacion: (select auth.uid()) evalua una vez
-- Referencia: Migracion 013 del repo existente
```

### 8.2 RBAC por Rol

| Recurso | owner | admin | operator | viewer |
|---|---|---|---|---|
| Plant CRUD | full | full | read | read |
| Trigger sync | yes | yes | yes | no |
| Configure alerts | yes | yes | yes | no |
| Team management | yes | yes | no | no |
| Billing | yes | no | no | no |
| API keys | yes | yes | no | no |
| View heatmap | yes | yes | yes | yes |
| View soiling | yes | yes | yes | yes |

### 8.3 Encriptacion de Credenciales

```typescript
// Credenciales de portales (GPM, Huawei) encriptadas con AES-256-GCM
// Patron existente: inverter_integrations del repo
// Key derivation: Supabase Vault o variable de entorno ENCRYPTION_KEY

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function encryptCredentials(plaintext: string, key: Buffer): EncryptedData {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}
```

---

## 9. Deployment

### 9.1 Infraestructura

```
Vercel (Frontend + API Routes + Server Actions)
  |
  +-- Next.js 16 App
  +-- Edge Functions (API routes)
  +-- Cron jobs (vercel.json)

Supabase (Backend)
  |
  +-- PostgreSQL (schema sundled)
  +-- Auth (email + OAuth)
  +-- Edge Functions (scraper workers)
  +-- Realtime (ingestion status)
  +-- Storage (SVG files, CSV uploads)

Stripe (Billing)
  |
  +-- Checkout Sessions
  +-- Customer Portal
  +-- Webhooks -> /api/billing/webhook
```

### 9.2 Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Encryption
PORTAL_ENCRYPTION_KEY=                # 32-byte hex for AES-256-GCM

# Email
RESEND_API_KEY=

# Billing
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# App
NEXT_PUBLIC_APP_URL=https://app.sundled.com
```

### 9.3 Dominios

```
app.sundled.com       -- SaaS application
api.sundled.com       -- Public API (future)
docs.sundled.com      -- Documentation (future)
```

---

## 10. Modelo de Pricing por String

### 10.1 Estructura de Tiers

| Plan | Precio/string/mes | Rango | Historia | Features |
|---|---|---|---|---|
| **Starter** | $0.50 USD | 1-100 strings | 30 dias | Dashboard, alertas basicas |
| **Professional** | $0.35 USD | 101-500 strings | 90 dias | + Soiling, API, 10 team members |
| **Enterprise** | $0.20 USD | 501+ strings | 365 dias | + Todo, team ilimitado, SLA |

### 10.2 Ejemplos de Pricing

| Planta | Strings | Plan | Costo mensual |
|---|---|---|---|
| Residencial 10kW | 12 strings | Starter | $6.00/mes |
| Comercial 100kW | 120 strings | Professional | $42.00/mes |
| ANGAMOS (actual) | 693 strings | Enterprise | $138.60/mes |
| Utility-scale 5MW | 2,000 strings | Enterprise | $400.00/mes |

### 10.3 Medicion de Uso

```typescript
// Contar strings activos por org
// string_used = SUM(plants.string_count) WHERE org_id = X AND is_active = true
// Verificar contra string_quota de organization
// Si string_used >= string_quota: bloquear creacion de plantas nuevas, mostrar upgrade prompt
```

### 10.4 Billing Lifecycle

```
1. Usuario se registra -> org creada con plan 'starter' (free trial 14 dias)
2. Agrega planta con N strings -> string_used += N
3. Si string_used > 100 -> prompt upgrade a 'professional'
4. Checkout via Stripe -> plan actualizado, quota incrementado
5. Monthly billing: string_used * price_per_string del plan activo
6. Downgrade: solo si string_used <= nuevo max_strings
```

---

## 11. Estrategia de Migracion (ANGAMOS como First Client)

### 11.1 Pasos de Onboarding

```
Paso 1: Crear organization "Sundled Demo" con plan enterprise
Paso 2: Crear planta "ANGAMOS" con configuracion:
  - timezone: America/Santiago
  - lat: -23.65, lon: -70.40
  - ct_count: 3, inverter_count: 40, string_count: 693
  - portal_type: 'gpm'
  - module_power_w: 540
  - energy_price: 0.08 USD/kWh
  - cleaning_cost: 120 USD

Paso 3: Upload Trackers.csv -> crea 693 registros en dim_trackers
  Fuente: Dashboard fotovoltaico/Planta/Dataset/Dimensiones/Trackers.csv

Paso 4: Upload SVG layout -> crea svg_layout
  Fuente: Dashboard fotovoltaico/Planta/svg_strings_selectable_clean.svg

Paso 5: Configurar credenciales GPM (encrypted)
  Query IDs: {
    "I_Strings_CT1": "402244",
    "I_Strings_CT2": "402254",
    "I_Strings_CT3": "402258",
    "V_String_CT1":  "402690",
    "V_String_CT2":  "402692",
    "V_String_CT3":  "402694",
    "POA":           "402696"
  }

Paso 6: Cargar datos historicos
  Fuente: Dashboard fotovoltaico/Planta/Dataset/Raw/2025/
  Modo: full (todos los dias disponibles)

Paso 7: Configurar schedule diario (cron 4am Santiago = 8am UTC)

Paso 8: Configurar alertas:
  - underperf_pct < 0.80 -> critical
  - underperf_pct < 0.95 -> warning
  - soiling_loss_pct > 10 -> warning
```

### 11.2 Validacion de Migracion

```
Checklist:
[ ] dim_trackers tiene 693 registros
[ ] svg_layout tiene ~693 elementos <rect>
[ ] fact_string cargado para fechas historicas
[ ] Heatmap renderiza colores correctamente
[ ] PoM coincide con strings_data.json existente (±0.01)
[ ] P_expected coincide con DAX de Power BI (±5%)
[ ] Clasificacion green/yellow/red coincide con Power BI
[ ] Soiling calculator produce mismas recomendaciones que soiling_service.py
```

---

## 12. Estructura de Carpetas del Proyecto

```
Sundled/
├── .claude/
│   ├── CLAUDE.md                        -- System prompt SaaS Factory V3
│   ├── commands/
│   └── settings.local.json
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── forgot-password/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── plants/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── dashboard/page.tsx
│   │   │   │       ├── heatmap/page.tsx
│   │   │   │       ├── soiling/page.tsx
│   │   │   │       ├── alerts/page.tsx
│   │   │   │       ├── ingestion/page.tsx
│   │   │   │       └── settings/page.tsx
│   │   │   ├── team/page.tsx
│   │   │   ├── billing/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── api/
│   │   │   ├── billing/webhook/route.ts
│   │   │   └── v1/                      -- Public API (Phase 3)
│   │   ├── layout.tsx
│   │   └── page.tsx                     -- Landing page
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types/
│   │   ├── plants/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── store/
│   │   │   └── types/
│   │   ├── ingestion/
│   │   │   ├── lib/
│   │   │   │   ├── adapters/            -- GPM, Huawei adapters
│   │   │   │   ├── etl/                 -- Pipeline (port of loader.py)
│   │   │   │   └── validators/          -- CSV validation
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   ├── heatmap/
│   │   │   ├── lib/
│   │   │   │   └── analytics-engine.ts  -- P_expected, underperf%, classify
│   │   │   ├── components/
│   │   │   │   ├── svg-heatmap.tsx
│   │   │   │   ├── string-data-grid.tsx
│   │   │   │   ├── color-legend.tsx
│   │   │   │   └── detail-panel.tsx
│   │   │   ├── store/
│   │   │   │   └── heatmap-store.ts     -- Zustand + Immer
│   │   │   ├── hooks/
│   │   │   │   └── use-colored-svg.ts   -- D3 color pipeline
│   │   │   └── types/
│   │   ├── soiling/
│   │   │   ├── lib/
│   │   │   │   └── soiling-engine.ts    -- Port of soiling_service.py
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   ├── alerts/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   ├── team/
│   │   │   ├── components/
│   │   │   └── types/
│   │   └── billing/
│   │       ├── components/
│   │       └── types/
│   ├── shared/
│   │   ├── components/
│   │   │   ├── ui/                      -- shadcn/ui components
│   │   │   ├── layout/
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── header.tsx
│   │   │   │   └── breadcrumb.tsx
│   │   │   └── data-display/
│   │   │       ├── data-table.tsx
│   │   │       └── stat-card.tsx
│   │   ├── hooks/
│   │   │   ├── use-org.ts               -- Organization context
│   │   │   └── use-permissions.ts       -- RBAC check
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts
│   │   │   │   ├── server.ts
│   │   │   │   └── middleware.ts
│   │   │   ├── stripe.ts
│   │   │   ├── resend.ts
│   │   │   └── encryption.ts            -- AES-256-GCM utils
│   │   └── types/
│   │       └── database.ts              -- Generated Supabase types
│   └── actions/
│       ├── plants.ts
│       ├── ingestion.ts
│       ├── readings.ts
│       ├── analytics.ts
│       ├── soiling.ts
│       ├── alerts.ts
│       ├── team.ts
│       └── billing.ts
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema_and_platform.sql
│   │   ├── 002_data_warehouse.sql
│   │   ├── 003_soiling_and_alerts.sql
│   │   ├── 004_ingestion_jobs.sql
│   │   ├── 005_rls_policies.sql
│   │   └── 006_indexes_and_functions.sql
│   ├── functions/
│   │   ├── trigger-ingestion/index.ts
│   │   └── process-scraper-job/index.ts
│   └── seed.sql                          -- ANGAMOS demo data
├── e2e/
│   ├── auth.spec.ts
│   ├── plants.spec.ts
│   ├── heatmap.spec.ts
│   └── ingestion.spec.ts
├── package.json
├── pnpm-lock.yaml
├── next.config.ts
├── tailwind.config.js
├── tsconfig.json
├── .env.example
└── CLAUDE.md
```

---

## 13. Archivos Fuente de Referencia (READ-ONLY)

Estos archivos del repo existente contienen la logica a portar:

| Archivo | Logica a extraer | Feature destino |
|---|---|---|
| `Supabase/loader.py` (801 lineas) | ETL completo: unpivot, regex, merge I+V, POA validation, inverter resolution, UPSERT | `features/ingestion/lib/etl/` |
| `Performance/.../soiling_service.py` | NOCT model, PR, soiling loss, break-even, 4-level recommendation | `features/soiling/lib/soiling-engine.ts` |
| `Zonelizer/lib/v2/store.ts` | Zustand+Immer store, clustering, sweep, assignment, undo/redo | `features/heatmap/store/heatmap-store.ts` |
| `Zonelizer/lib/v2/hooks/useColoredSVG.ts` | D3 color pipeline, domain computation, legend generation | `features/heatmap/hooks/use-colored-svg.ts` |
| `Zonelizer/lib/core/color.ts` | getColorScale(), getLegendStops(), formatValue() | `shared/lib/color-scale.ts` |
| `Zonelizer/lib/core/svg.ts` | parseSVG(), applySVGStyles(), resetSVGStyles() | `features/heatmap/lib/svg-utils.ts` |
| `Zonelizer/lib/core/csv.ts` | parseCSV(), validateRows(), detectColumns(), mergeById() | `features/ingestion/lib/validators/` |
| `Zonelizer/components/v2/SvgEditor.tsx` | Event delegation, selection, tooltips | `features/heatmap/components/svg-heatmap.tsx` |
| `Zonelizer/components/v2/DataGrid.tsx` | Tabla filtrable con seleccion bidireccional | `features/heatmap/components/string-data-grid.tsx` |
| `webscraper GPM v3.0/src/core/authenticator.py` | Login flow, selectores, session detection | `features/ingestion/lib/adapters/gpm-adapter.ts` |
| `webscraper GPM v3.0/src/core/downloader.py` | Retry exponencial, URL builder, download capture | `features/ingestion/lib/adapters/gpm-adapter.ts` |
| `webscraper GPM v3.0/src/validators/csv_validator.py` | Encoding, headers, timestamps, row count | `features/ingestion/lib/validators/csv-validator.ts` |
| `webscraper GPM v3.0/config/queries.yaml` | Query IDs (402244-402696) | `features/ingestion/lib/adapters/gpm-queries.ts` |
| `Planta/data_processor.py` | PoM = current / median_inverter | `features/heatmap/lib/analytics-engine.ts` |
| `Planta/GEMINI.md` | DAX formulas, Vega-Lite spec, KPI definitions | `features/heatmap/lib/analytics-engine.ts` |
| `Planta/mockup_strings_dashboard (2).html` | UI layout, color scheme, filter logic | `features/heatmap/components/` |
| `Supabase/Consultas_PowerBI.txt` | Power Query M functions (validation reference) | Cross-reference for ETL correctness |

---

## 14. Criterios de Aceptacion

### Fase 1 (MVP)
- [ ] Usuario puede registrarse, crear org, agregar planta
- [ ] Upload de Trackers.csv crea dim_trackers correctamente
- [ ] Upload de SVG crea svg_layout
- [ ] Sync manual descarga CSVs de GPM y carga a fact_string
- [ ] Dashboard muestra KPIs basicos y time series
- [ ] RLS impide acceso cross-tenant
- [ ] pnpm install && pnpm build exitoso sin errores

### Fase 2
- [ ] Heatmap SVG renderiza con colores correctos (green/yellow/red/gray)
- [ ] P_expected coincide con P75 historico (±5% vs Power BI)
- [ ] Soiling calculator produce recomendaciones OK/WATCH/RECOMMENDED/URGENT
- [ ] Alertas se disparan y envian email via Resend
- [ ] Cooldown de 24h funciona

### Fase 3
- [ ] Team invite por email funciona
- [ ] RBAC restringe acciones correctamente
- [ ] Stripe checkout crea suscripcion por string
- [ ] API keys generan y autentican correctamente

### Fase 4
- [ ] Reportes PDF generados automaticamente
- [ ] Prediccion de soiling con regresion lineal
- [ ] PWA funciona en movil

---

## 15. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigacion |
|---|---|---|
| Playwright en Edge Functions tiene limitaciones | Alto | Evaluar Browserless.io como servicio externo |
| GPM portal cambia DOM/selectores | Medio | Adapter pattern permite actualizar sin afectar ETL |
| Volumen de datos crece exponencialmente | Alto | Partitioning de fact_string por mes, BRIN indexes |
| Latencia en heatmap con 693+ elementos | Medio | CSS class fallback para >200 elements, memoization |
| Credenciales de portal comprometidas | Critico | AES-256-GCM, Supabase Vault, audit log |
| Stripe webhook perdido | Medio | Idempotency keys, reconciliacion diaria |

---

> **Siguiente paso**: Clonar jona-conveyor, renombrar a Sundled, configurar pnpm, y comenzar Fase 1 (auth + plants + ingestion MVP).
