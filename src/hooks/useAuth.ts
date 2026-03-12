'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { OrgRole } from '@/types/database'

interface AuthState {
  user: User | null
  orgId: string | null
  role: OrgRole | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    orgId: null,
    role: null,
    loading: true,
  })

  useEffect(() => {
    const supabase = createClient()

    async function loadMembership(userId: string) {
      const { data } = await supabase
        .from('org_members')
        .select('org_id, role')
        .eq('user_id', userId)
        .single()

      setState(prev => ({
        ...prev,
        orgId: data?.org_id ?? null,
        role: (data?.role as OrgRole) ?? null,
      }))
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      setState(prev => ({ ...prev, user, loading: false }))
      if (user) loadMembership(user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null
        setState(prev => ({ ...prev, user: currentUser, loading: false }))
        if (currentUser) {
          loadMembership(currentUser.id)
        } else {
          setState(prev => ({ ...prev, orgId: null, role: null }))
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return state
}
