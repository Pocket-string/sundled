-- TICKET-003: Daily String Summary — persistent daily analytics for historical tracking
-- Stores one row per string per day with peak-energy analysis results + energy losses.
-- Enables: "since when?", cumulative loss (Wh), $/day, trend charts.
-- ~100 KB/day (~38 MB/year) vs ~8.3 MB/day for raw fact_string.

-- =============================================================
-- SUNALIZE SCHEMA (Demo / Legacy)
-- =============================================================

CREATE TABLE IF NOT EXISTS sunalize.daily_string_summary (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id              TEXT NOT NULL,
  date                  DATE NOT NULL,
  string_id             TEXT NOT NULL,
  svg_id                TEXT,
  inverter_id           TEXT,
  peer_group            TEXT,
  module_w              INTEGER,

  -- Peak energy analysis results (from getAnalyticsSnapshotDemo)
  p_string_avg          DOUBLE PRECISION,   -- avg power during peak intervals (W)
  p_expected_avg        DOUBLE PRECISION,   -- avg P75 reference during peak intervals (W)
  underperf_ratio       DOUBLE PRECISION,   -- PI = sumP / sumPRef
  underperf_delta_w     DOUBLE PRECISION,   -- avg deficit per interval (W)
  class                 TEXT NOT NULL,       -- green/blue/orange/red/gray
  reference_method      TEXT NOT NULL,       -- 'module_group_p75' | 'insufficient_data'

  -- Energy loss — the product differentiator
  energy_loss_wh        DOUBLE PRECISION,   -- total Wh lost = Σ max(p_expected - p_actual, 0) × 0.5h
  peak_intervals        INTEGER NOT NULL DEFAULT 0,  -- number of 30-min peak intervals used
  peak_poa_threshold    DOUBLE PRECISION,   -- POA P95 threshold used for peak selection (W/m²)
  avg_poa               DOUBLE PRECISION,   -- avg POA during peak intervals (W/m²)

  computed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plant_id, date, string_id)
);

-- Primary access: plant + date range
CREATE INDEX ix_daily_summary_plant_date
  ON sunalize.daily_string_summary (plant_id, date DESC);

-- String-level drilldown: "since when has this string been underperforming?"
CREATE INDEX ix_daily_summary_string_date
  ON sunalize.daily_string_summary (plant_id, string_id, date DESC);

-- Filter by class: find all red/orange strings across dates
CREATE INDEX ix_daily_summary_class
  ON sunalize.daily_string_summary (plant_id, class, date DESC);

-- Inverter-level aggregation
CREATE INDEX ix_daily_summary_inverter
  ON sunalize.daily_string_summary (plant_id, inverter_id, date DESC);


-- =============================================================
-- PUBLIC SCHEMA (SaaS / Multi-tenant)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.daily_string_summary (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plant_id              UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  date                  DATE NOT NULL,
  string_id             TEXT NOT NULL,
  svg_id                TEXT,
  inverter_id           TEXT,
  peer_group            TEXT,
  module_w              INTEGER,

  p_string_avg          DOUBLE PRECISION,
  p_expected_avg        DOUBLE PRECISION,
  underperf_ratio       DOUBLE PRECISION,
  underperf_delta_w     DOUBLE PRECISION,
  class                 TEXT NOT NULL CHECK (class IN ('green', 'blue', 'orange', 'red', 'gray')),
  reference_method      TEXT NOT NULL,

  energy_loss_wh        DOUBLE PRECISION,
  peak_intervals        INTEGER NOT NULL DEFAULT 0,
  peak_poa_threshold    DOUBLE PRECISION,
  avg_poa               DOUBLE PRECISION,

  computed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plant_id, date, string_id)
);

ALTER TABLE public.daily_string_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_summary_select_own" ON public.daily_string_summary
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "daily_summary_insert_own" ON public.daily_string_summary
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin', 'operator'))
  );

CREATE POLICY "daily_summary_update_own" ON public.daily_string_summary
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin', 'operator'))
  );

CREATE POLICY "daily_summary_delete_own" ON public.daily_string_summary
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin'))
  );

CREATE INDEX ix_pub_daily_summary_plant_date
  ON public.daily_string_summary (plant_id, date DESC);
CREATE INDEX ix_pub_daily_summary_string_date
  ON public.daily_string_summary (plant_id, string_id, date DESC);
CREATE INDEX ix_pub_daily_summary_class
  ON public.daily_string_summary (plant_id, class, date DESC);
CREATE INDEX ix_pub_daily_summary_inverter
  ON public.daily_string_summary (plant_id, inverter_id, date DESC);
CREATE INDEX ix_pub_daily_summary_org
  ON public.daily_string_summary (org_id, plant_id);
