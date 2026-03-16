import { tool } from 'ai'
import { z } from 'zod'
import {
  executePlantStatus,
  executeTopUnderperformers,
  executeCompareEntities,
  executeRecentDetail,
} from './query-executor'

const plantStatusParams = z.object({
  plant_id: z.string().describe('ID de la planta, ej: PLT_A'),
  date: z.string().optional().describe('Fecha en formato YYYY-MM-DD'),
  period: z.enum(['today', 'last_7d', 'last_30d']).default('today'),
})

const topUnderperformersParams = z.object({
  plant_id: z.string().describe('ID de la planta'),
  entity_type: z.enum(['string', 'inverter']).describe('Tipo de entidad'),
  metric: z.enum(['energy_loss_wh', 'underperf_ratio']).default('energy_loss_wh'),
  date_start: z.string().optional().describe('Fecha inicio YYYY-MM-DD'),
  date_end: z.string().optional().describe('Fecha fin YYYY-MM-DD'),
  limit: z.number().min(1).max(25).default(10),
})

const compareEntitiesParams = z.object({
  plant_id: z.string().describe('ID de la planta'),
  comparison_type: z.enum(['strings', 'inverters', 'periods']),
  entity_a: z.string().describe('Primera entidad o fecha'),
  entity_b: z.string().describe('Segunda entidad o fecha'),
  date_start: z.string().optional(),
  date_end: z.string().optional(),
  metrics: z.array(z.enum([
    'p_string_avg', 'underperf_ratio', 'energy_loss_wh', 'class_distribution',
  ])).default(['p_string_avg', 'underperf_ratio']),
})

const recentDetailParams = z.object({
  plant_id: z.string().describe('ID de la planta'),
  entity_type: z.enum(['string', 'inverter']),
  entity_id: z.string().describe('ID del string o inversor'),
  date_start: z.string().describe('Fecha inicio YYYY-MM-DD'),
  date_end: z.string().describe('Fecha fin YYYY-MM-DD'),
})

export function getAnalystTools() {
  return {
    queryPlantStatus: tool({
      description:
        'Consulta el estado general de la planta fotovoltaica: distribucion de clasificaciones, perdidas totales, strings criticos.',
      inputSchema: plantStatusParams,
      execute: async (params) => executePlantStatus(params),
    }),

    queryTopUnderperformers: tool({
      description:
        'Obtiene el ranking de strings o inversores con peor rendimiento, ordenados por perdida energetica o ratio.',
      inputSchema: topUnderperformersParams,
      execute: async (params) => executeTopUnderperformers(params),
    }),

    compareEntities: tool({
      description:
        'Compara dos entidades (strings, inversores) o dos periodos de tiempo con metricas lado a lado.',
      inputSchema: compareEntitiesParams,
      execute: async (params) => executeCompareEntities(params),
    }),

    queryRecentDetail: tool({
      description:
        'Obtiene datos granulares (corriente, voltaje, potencia, POA) de un string o inversor en rango corto (max 48h).',
      inputSchema: recentDetailParams,
      execute: async (params) => executeRecentDetail(params),
    }),
  }
}
