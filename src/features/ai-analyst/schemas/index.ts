import { z } from 'zod'

export const queryPlantStatusSchema = z.object({
  plant_id: z.string().describe('ID de la planta, ej: PLT_A'),
  date: z.string().optional().describe('Fecha en formato YYYY-MM-DD. Por defecto: ultima disponible'),
  period: z.enum(['today', 'last_7d', 'last_30d']).default('today')
    .describe('Periodo de analisis'),
})

export const queryTopUnderperformersSchema = z.object({
  plant_id: z.string().describe('ID de la planta'),
  entity_type: z.enum(['string', 'inverter']).describe('Tipo de entidad a consultar'),
  metric: z.enum(['energy_loss_wh', 'underperf_ratio']).default('energy_loss_wh')
    .describe('Metrica para ordenar'),
  date_start: z.string().optional().describe('Fecha inicio YYYY-MM-DD'),
  date_end: z.string().optional().describe('Fecha fin YYYY-MM-DD'),
  limit: z.number().min(1).max(25).default(10).describe('Numero maximo de resultados'),
})

export const compareEntitiesSchema = z.object({
  plant_id: z.string().describe('ID de la planta'),
  comparison_type: z.enum(['strings', 'inverters', 'periods'])
    .describe('Tipo de comparacion'),
  entity_a: z.string().describe('Primera entidad (string_id, inverter_id, o fecha inicio)'),
  entity_b: z.string().describe('Segunda entidad'),
  date_start: z.string().optional().describe('Fecha inicio del rango'),
  date_end: z.string().optional().describe('Fecha fin del rango'),
  metrics: z.array(z.enum([
    'p_string_avg', 'underperf_ratio', 'energy_loss_wh', 'class_distribution',
  ])).default(['p_string_avg', 'underperf_ratio'])
    .describe('Metricas a comparar'),
})

export const queryRecentDetailSchema = z.object({
  plant_id: z.string().describe('ID de la planta'),
  entity_type: z.enum(['string', 'inverter']).describe('Tipo de entidad'),
  entity_id: z.string().describe('ID especifico del string o inversor'),
  date_start: z.string().describe('Fecha inicio YYYY-MM-DD (max 48h de rango)'),
  date_end: z.string().describe('Fecha fin YYYY-MM-DD'),
})

export const chatMessageSchema = z.object({
  content: z.string().min(1).max(1500),
})
