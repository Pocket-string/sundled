// ============================================
// TIPOS DEL DOMINIO - Lucvia
// ============================================

export type OrgRole = 'owner' | 'admin' | 'operator' | 'viewer'

export type OnboardingStatus = 'draft' | 'files_ready' | 'ready_to_sync' | 'active'

export type SyncStatus = 'success' | 'partial' | 'error'

export type PortalType = 'gpm' | 'huawei' | 'manual' | 'api'

export type JobStatus = 'pending' | 'running' | 'success' | 'partial' | 'error' | 'cancelled'

// ============================================
// Platform
// ============================================

export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  created_at: string
}

// ============================================
// Domain: Plants
// ============================================

export interface Plant {
  id: string
  org_id: string
  name: string
  slug: string
  timezone: string
  lat: number | null
  lon: number | null
  ct_count: number
  inverter_count: number
  string_count: number
  module_power_w: number | null
  energy_price: number | null
  cleaning_cost: number | null
  currency: string
  portal_type: PortalType | null
  is_active: boolean
  onboarding_status: OnboardingStatus
  last_sync_at: string | null
  last_sync_status: SyncStatus | null
  created_at: string
  updated_at: string
}

export interface PlantIntegration {
  id: string
  org_id: string
  plant_id: string
  portal_type: PortalType
  credentials_encrypted: string
  credentials_iv: string
  credentials_tag: string
  query_ids_json: Record<string, string> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================
// Data Warehouse (Star Schema)
// ============================================

export interface DimTracker {
  id: string
  org_id: string
  plant_id: string
  ct_id: string
  inverter_id: string
  inverter_base: string | null
  tracker_id: string
  string_label: string
  dc_in: number
  module: string | null
  string_id: string       // "CT1-INV 1-1-TRK1-S1"
  svg_id: string          // "CT1_INV1-1_TRK1_S1"
  inverter_dc_key: string // "INV 1-1|1"
  peer_group: string | null
  created_at: string
  updated_at: string
}

export interface SvgLayoutRow {
  id: string
  org_id: string
  plant_id: string
  svg_id: string
  tag: string | null
  css_class: string | null
  title: string | null
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  created_at: string
}

export interface FactString {
  id: string
  org_id: string
  plant_id: string
  ts_local: string
  ts_utc: string | null
  string_id: string
  svg_id: string | null
  inverter_id: string | null
  inverter_dc_key: string | null
  dc_in: number | null
  module: string | null
  peer_group: string | null
  i_string: number | null  // Current (A)
  v_string: number | null  // Voltage (V)
  p_string: number | null  // Power (W) = I * V
  poa: number | null       // Irradiance (W/m2)
  t_mod: number | null     // Module temp (degC)
  created_at: string
  updated_at: string
}

// ============================================
// Operations
// ============================================

export interface IngestionJob {
  id: string
  org_id: string
  plant_id: string
  triggered_by: string | null
  status: JobStatus
  date_start: string
  date_end: string
  records_loaded: number
  records_expected: number | null
  error_message: string | null
  manifest_json: Record<string, unknown> | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// ============================================
// DTOs
// ============================================

export interface CreatePlantDTO {
  name: string
  slug: string
  timezone?: string
  lat?: number
  lon?: number
  ct_count?: number
  module_power_w?: number
  energy_price?: number
  cleaning_cost?: number
  currency?: string
  portal_type?: PortalType
}

export interface UpdatePlantDTO {
  name?: string
  timezone?: string
  lat?: number
  lon?: number
  module_power_w?: number
  energy_price?: number
  cleaning_cost?: number
  currency?: string
  portal_type?: PortalType
  is_active?: boolean
}

// ============================================
// Permissions
// ============================================

export const ROLE_PERMISSIONS = {
  owner:    { canManagePlants: true,  canTriggerSync: true,  canManageTeam: true,  canManageBilling: true,  canViewData: true  },
  admin:    { canManagePlants: true,  canTriggerSync: true,  canManageTeam: true,  canManageBilling: false, canViewData: true  },
  operator: { canManagePlants: false, canTriggerSync: true,  canManageTeam: false, canManageBilling: false, canViewData: true  },
  viewer:   { canManagePlants: false, canTriggerSync: false, canManageTeam: false, canManageBilling: false, canViewData: true  },
} as const

export type Permission = keyof typeof ROLE_PERMISSIONS.owner

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role][permission]
}
