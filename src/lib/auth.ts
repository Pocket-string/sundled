import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export interface AuthContext {
  userId: string
  email: string
}

export interface OrgContext extends AuthContext {
  orgId: string
  role: 'owner' | 'admin' | 'operator' | 'viewer'
}

/**
 * Require authenticated user. Redirects to /login if not authenticated.
 */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return {
    userId: user.id,
    email: user.email ?? '',
  }
}

/**
 * Require authenticated user with org membership.
 * Redirects to /login if not authenticated.
 * Throws if user has no org membership.
 */
export async function requireOrg(): Promise<OrgContext> {
  const auth = await requireAuth()
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', auth.userId)
    .single()

  if (!member) {
    // Auto-bootstrap: create org for new user
    const orgId = await bootstrapOrg(auth.userId, auth.email)
    return {
      ...auth,
      orgId,
      role: 'owner',
    }
  }

  return {
    ...auth,
    orgId: member.org_id,
    role: member.role as OrgContext['role'],
  }
}

/**
 * Require specific role(s). Throws 403 if not authorized.
 */
export async function requireRole(
  allowedRoles: OrgContext['role'][]
): Promise<OrgContext> {
  const ctx = await requireOrg()

  if (!allowedRoles.includes(ctx.role)) {
    throw new Error('Forbidden: insufficient permissions')
  }

  return ctx
}

/**
 * Bootstrap organization and owner membership for a new user.
 */
async function bootstrapOrg(userId: string, email: string): Promise<string> {
  const supabase = await createClient()

  const orgName = email.split('@')[0] ?? 'My Organization'
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50)

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: orgName, slug: `${slug}-${Date.now()}` })
    .select('id')
    .single()

  if (orgError || !org) {
    throw new Error(`Failed to create organization: ${orgError?.message}`)
  }

  const { error: memberError } = await supabase
    .from('org_members')
    .insert({ org_id: org.id, user_id: userId, role: 'owner' })

  if (memberError) {
    throw new Error(`Failed to create membership: ${memberError.message}`)
  }

  return org.id
}
