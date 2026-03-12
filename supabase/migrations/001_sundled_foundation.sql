-- Sundled Foundation MVP: Schema sundled
-- All tables include org_id for RLS isolation

-- =============================================================
-- PLATFORM TABLES
-- =============================================================

-- Organizations (multi-tenant root)
CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select_own" ON public.organizations
  FOR SELECT USING (
    id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "org_insert_auth" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "org_update_own" ON public.organizations
  FOR UPDATE USING (
    id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin'))
  );

-- Organization Members
CREATE TABLE IF NOT EXISTS public.org_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_own_org" ON public.org_members
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_members AS m WHERE m.user_id = (SELECT auth.uid()))
  );

CREATE POLICY "members_insert_auth" ON public.org_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================
-- DOMAIN TABLES
-- =============================================================

-- Plants
CREATE TABLE IF NOT EXISTS public.plants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL,
  timezone            TEXT NOT NULL DEFAULT 'America/Santiago',
  lat                 NUMERIC CHECK (lat BETWEEN -90 AND 90),
  lon                 NUMERIC CHECK (lon BETWEEN -180 AND 360),
  ct_count            INTEGER NOT NULL DEFAULT 1,
  inverter_count      INTEGER NOT NULL DEFAULT 0,
  string_count        INTEGER NOT NULL DEFAULT 0,
  module_power_w      NUMERIC CHECK (module_power_w IS NULL OR module_power_w > 0),
  energy_price        NUMERIC CHECK (energy_price IS NULL OR energy_price > 0),
  cleaning_cost       NUMERIC CHECK (cleaning_cost IS NULL OR cleaning_cost > 0),
  currency            TEXT DEFAULT 'USD',
  portal_type         TEXT CHECK (portal_type IS NULL OR portal_type IN ('gpm', 'huawei', 'manual', 'api')),
  is_active           BOOLEAN DEFAULT true,
  onboarding_status   TEXT NOT NULL DEFAULT 'draft'
                      CHECK (onboarding_status IN ('draft', 'files_ready', 'ready_to_sync', 'active')),
  last_sync_at        TIMESTAMPTZ,
  last_sync_status    TEXT CHECK (last_sync_status IS NULL OR last_sync_status IN ('success', 'partial', 'error')),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slug)
);

ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plants_select_own" ON public.plants
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "plants_insert_own" ON public.plants
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin'))
  );

CREATE POLICY "plants_update_own" ON public.plants
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin'))
  );

CREATE POLICY "plants_delete_own" ON public.plants
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin'))
  );

-- Plant Integrations (encrypted credentials)
CREATE TABLE IF NOT EXISTS public.plant_integrations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plant_id                UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  portal_type             TEXT NOT NULL CHECK (portal_type IN ('gpm', 'huawei')),
  credentials_encrypted   TEXT NOT NULL,
  credentials_iv          TEXT NOT NULL,
  credentials_tag         TEXT NOT NULL,
  query_ids_json          JSONB,
  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plant_id)
);

ALTER TABLE public.plant_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_select_own" ON public.plant_integrations
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin'))
  );

CREATE POLICY "integrations_insert_own" ON public.plant_integrations
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin'))
  );

CREATE POLICY "integrations_update_own" ON public.plant_integrations
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin'))
  );

-- =============================================================
-- DATA WAREHOUSE (Star Schema)
-- =============================================================

-- Dimension: Trackers (strings hierarchy)
CREATE TABLE IF NOT EXISTS public.dim_trackers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plant_id        UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  ct_id           TEXT NOT NULL,
  inverter_id     TEXT NOT NULL,
  inverter_base   TEXT,
  tracker_id      TEXT NOT NULL,
  string_label    TEXT NOT NULL,
  dc_in           INTEGER NOT NULL,
  module          TEXT,
  string_id       TEXT NOT NULL,
  svg_id          TEXT NOT NULL,
  inverter_dc_key TEXT NOT NULL,
  peer_group      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plant_id, string_id)
);

ALTER TABLE public.dim_trackers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trackers_select_own" ON public.dim_trackers
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "trackers_insert_own" ON public.dim_trackers
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin'))
  );

CREATE INDEX ix_dim_trackers_plant ON public.dim_trackers (plant_id);
CREATE INDEX ix_dim_trackers_invdc ON public.dim_trackers (plant_id, inverter_id, dc_in);
CREATE INDEX ix_dim_trackers_svg ON public.dim_trackers (plant_id, svg_id);

-- SVG Layout (visual coordinates)
CREATE TABLE IF NOT EXISTS public.svg_layout (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plant_id        UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  svg_id          TEXT NOT NULL,
  tag             TEXT,
  css_class       TEXT,
  title           TEXT,
  x               DOUBLE PRECISION,
  y               DOUBLE PRECISION,
  width           DOUBLE PRECISION,
  height          DOUBLE PRECISION,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plant_id, svg_id)
);

ALTER TABLE public.svg_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svg_select_own" ON public.svg_layout
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "svg_insert_own" ON public.svg_layout
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin'))
  );

-- Fact: String measurements (time series)
CREATE TABLE IF NOT EXISTS public.fact_string (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plant_id        UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  ts_local        TIMESTAMP NOT NULL,
  ts_utc          TIMESTAMPTZ,
  string_id       TEXT NOT NULL,
  svg_id          TEXT,
  inverter_id     TEXT,
  inverter_dc_key TEXT,
  dc_in           INTEGER,
  module          TEXT,
  peer_group      TEXT,
  i_string        DOUBLE PRECISION,
  v_string        DOUBLE PRECISION,
  p_string        DOUBLE PRECISION,
  poa             DOUBLE PRECISION,
  t_mod           DOUBLE PRECISION,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plant_id, ts_local, string_id)
);

ALTER TABLE public.fact_string ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fact_select_own" ON public.fact_string
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "fact_insert_own" ON public.fact_string
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin', 'operator'))
  );

CREATE POLICY "fact_update_own" ON public.fact_string
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin', 'operator'))
  );

CREATE INDEX ix_fact_plant_ts ON public.fact_string (plant_id, ts_local DESC);
CREATE INDEX ix_fact_string ON public.fact_string (plant_id, string_id, ts_local DESC);
CREATE INDEX ix_fact_org ON public.fact_string (org_id, plant_id);

-- =============================================================
-- OPERATION TABLES
-- =============================================================

-- Ingestion Jobs
CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plant_id          UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  triggered_by      UUID REFERENCES auth.users(id),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'success', 'partial', 'error', 'cancelled')),
  date_start        DATE NOT NULL,
  date_end          DATE NOT NULL,
  records_loaded    INTEGER DEFAULT 0,
  records_expected  INTEGER,
  error_message     TEXT,
  manifest_json     JSONB,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_select_own" ON public.ingestion_jobs
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "jobs_insert_own" ON public.ingestion_jobs
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin', 'operator'))
  );

CREATE POLICY "jobs_update_own" ON public.ingestion_jobs
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin', 'operator'))
  );

CREATE INDEX ix_jobs_plant_status ON public.ingestion_jobs (plant_id, status);
CREATE INDEX ix_jobs_org ON public.ingestion_jobs (org_id, plant_id);
