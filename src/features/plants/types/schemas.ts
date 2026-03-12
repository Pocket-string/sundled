import { z } from 'zod'

export const createPlantSchema = z.object({
  name: z.string().min(2, 'Nombre debe tener al menos 2 caracteres').max(100),
  timezone: z.string().default('America/Santiago'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(360).optional(),
  ct_count: z.coerce.number().int().min(1).default(1),
  module_power_w: z.coerce.number().positive().optional(),
  energy_price: z.coerce.number().positive().optional(),
  cleaning_cost: z.coerce.number().positive().optional(),
  currency: z.enum(['USD', 'EUR', 'CLP', 'GBP', 'MXN', 'BRL']).default('USD'),
  portal_type: z.enum(['gpm', 'huawei', 'manual', 'api']).optional(),
})

export type CreatePlantInput = z.infer<typeof createPlantSchema>

export const updatePlantSchema = createPlantSchema.partial()

export type UpdatePlantInput = z.infer<typeof updatePlantSchema>

/** Trackers.csv row schema — separator ";" */
export const trackerRowSchema = z.object({
  CT: z.string().min(1),
  Inverter: z.string().min(1),
  Tracker: z.string().min(1),
  String: z.string().min(1),
  dc_in: z.coerce.number().int().min(1),
  module: z.coerce.number().optional(),
})

export type TrackerRow = z.infer<typeof trackerRowSchema>
