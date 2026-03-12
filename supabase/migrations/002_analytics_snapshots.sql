-- TICKET-002: Analytics Layer — string_analytics_snapshots
-- Persistent analytics results computed server-side

CREATE TABLE IF NOT EXISTS public.string_analytics_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plant_id              UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  ts_utc                TIMESTAMPTZ NOT NULL,
  ts_local              TIMESTAMP NOT NULL,
  string_id             TEXT NOT NULL,
  svg_id                TEXT,
  inverter_id           TEXT,
  tracker_id            TEXT,
  dc_in                 INTEGER,
  peer_group            TEXT,
  poa                   DOUBLE PRECISION,
  t_mod                 DOUBLE PRECISION,
  i_string              DOUBLE PRECISION,
  v_string              DOUBLE PRECISION,
  p_string              DOUBLE PRECISION,
  p_expected            DOUBLE PRECISION,
  underperf_ratio       DOUBLE PRECISION,
  underperf_delta_w     DOUBLE PRECISION,
  class                 TEXT NOT NULL CHECK (class IN ('green', 'yellow', 'red', 'gray')),
  reference_method      TEXT NOT NULL CHECK (reference_method IN (
    'same_string_p75', 'same_string_relaxed_p75', 'peer_group_fallback', 'insufficient_data'
  )),
  reference_sample_size INTEGER NOT NULL DEFAULT 0,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plant_id, string_id, ts_utc)
);

-- RLS
ALTER TABLE public.string_analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots_select_own" ON public.string_analytics_snapshots
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "snapshots_insert_own" ON public.string_analytics_snapshots
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin', 'operator'))
  );

CREATE POLICY "snapshots_update_own" ON public.string_analytics_snapshots
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin', 'operator'))
  );

CREATE POLICY "snapshots_delete_own" ON public.string_analytics_snapshots
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin'))
  );

-- Indices
CREATE INDEX ix_snapshots_plant_ts ON public.string_analytics_snapshots (plant_id, ts_utc);
CREATE INDEX ix_snapshots_plant_class_ts ON public.string_analytics_snapshots (plant_id, class, ts_utc);
CREATE INDEX ix_snapshots_plant_inv_ts ON public.string_analytics_snapshots (plant_id, inverter_id, ts_utc);
CREATE INDEX ix_snapshots_plant_tracker_ts ON public.string_analytics_snapshots (plant_id, tracker_id, ts_utc);
CREATE INDEX ix_snapshots_org ON public.string_analytics_snapshots (org_id, plant_id);
