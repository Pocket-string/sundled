'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOrg } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'
import { z } from 'zod'

const gpmConfigSchema = z.object({
  username: z.string().min(1, 'Username requerido'),
  password: z.string().min(1, 'Password requerido'),
  query_I_CT1: z.string().min(1, 'Query ID requerido'),
  query_I_CT2: z.string().optional(),
  query_I_CT3: z.string().optional(),
  query_V_CT1: z.string().min(1, 'Query ID requerido'),
  query_V_CT2: z.string().optional(),
  query_V_CT3: z.string().optional(),
  query_POA: z.string().min(1, 'Query ID requerido'),
})

export async function saveGpmIntegration(plantId: string, formData: FormData) {
  const ctx = await requireOrg()
  const supabase = await createClient()

  const raw = Object.fromEntries(formData.entries())
  const parsed = gpmConfigSchema.safeParse(raw)

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { username, password, ...queryFields } = parsed.data

  // Build query IDs map (only non-empty values)
  const queryIds: Record<string, string> = {}
  for (const [key, val] of Object.entries(queryFields)) {
    if (val) queryIds[key.replace('query_', '')] = val
  }

  // Encrypt credentials
  const credentials = JSON.stringify({ username, password })
  const { encrypted, iv, tag } = encrypt(credentials)

  // Upsert integration
  const { error } = await supabase
    .from('plant_integrations')
    .upsert(
      {
        org_id: ctx.orgId,
        plant_id: plantId,
        portal_type: 'gpm' as const,
        credentials_encrypted: encrypted,
        credentials_iv: iv,
        credentials_tag: tag,
        query_ids_json: queryIds,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'plant_id' }
    )

  if (error) {
    return { error: error.message }
  }

  // Check if plant can transition to ready_to_sync
  const [{ count: trackerCount }, { count: layoutCount }] = await Promise.all([
    supabase.from('dim_trackers').select('*', { count: 'exact', head: true }).eq('plant_id', plantId),
    supabase.from('svg_layout').select('*', { count: 'exact', head: true }).eq('plant_id', plantId),
  ])

  if ((trackerCount ?? 0) > 0 && (layoutCount ?? 0) > 0) {
    await supabase
      .from('plants')
      .update({ onboarding_status: 'ready_to_sync', updated_at: new Date().toISOString() })
      .eq('id', plantId)
      .eq('onboarding_status', 'files_ready')
  }

  revalidatePath(`/plants/${plantId}`)
  return { success: true }
}
