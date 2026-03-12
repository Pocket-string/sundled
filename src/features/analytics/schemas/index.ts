import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const rebuildAnalyticsSchema = z
  .object({
    plantId: z.string().min(1, 'plantId requerido'),
    dateStart: z.string().regex(dateRegex, 'Formato: YYYY-MM-DD'),
    dateEnd: z.string().regex(dateRegex, 'Formato: YYYY-MM-DD'),
  })
  .refine(
    (data) => {
      const start = new Date(data.dateStart)
      const end = new Date(data.dateEnd)
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      return diffDays >= 0 && diffDays <= 7
    },
    { message: 'Rango maximo permitido: 7 dias' }
  )

export const snapshotQuerySchema = z.object({
  plantId: z.string().min(1),
  date: z.string().regex(dateRegex).optional(),
  ts: z.string().optional(),
})

export type RebuildAnalyticsInput = z.infer<typeof rebuildAnalyticsSchema>
export type SnapshotQueryInput = z.infer<typeof snapshotQuerySchema>
