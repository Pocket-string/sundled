import { createClient } from '@/lib/supabase/client'
import type { AppointmentWithRelations } from '@/types/database'

export interface DashboardStats {
  totalAppointments: number
  pendingAppointments: number
  confirmedAppointments: number
  completedAppointments: number
  upcomingToday: number
  monthlyRevenue: number
}

export interface LawyerAnalytics {
  id: string
  name: string
  totalAppointments: number
  completedAppointments: number
  pendingAppointments: number
  monthlyRevenue: number
  averageRating: number
}

export interface AdminDashboardStats {
  totalLawyers: number
  activeLawyers: number
  totalClients: number
  totalAppointments: number
  monthlyRevenue: number
  pendingAppointments: number
  todayAppointments: number
  lawyerAnalytics: LawyerAnalytics[]
}

export const dashboardService = {
  async getStats(userId: string, role: 'client' | 'lawyer'): Promise<DashboardStats> {
    const supabase = createClient()

    // Obtener ID según rol
    let entityId: string | null = null

    if (role === 'client') {
      const { data } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .single()
      entityId = data?.id || null
    } else {
      const { data } = await supabase
        .from('lawyers')
        .select('id')
        .eq('user_id', userId)
        .single()
      entityId = data?.id || null
    }

    if (!entityId) {
      return {
        totalAppointments: 0,
        pendingAppointments: 0,
        confirmedAppointments: 0,
        completedAppointments: 0,
        upcomingToday: 0,
        monthlyRevenue: 0
      }
    }

    const column = role === 'client' ? 'client_id' : 'lawyer_id'

    // Contar citas por estado
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, status, scheduled_at, appointment_type:appointment_types(price)')
      .eq(column, entityId)

    const stats = {
      totalAppointments: 0,
      pendingAppointments: 0,
      confirmedAppointments: 0,
      completedAppointments: 0,
      upcomingToday: 0,
      monthlyRevenue: 0
    }

    if (!appointments) return stats

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    for (const apt of appointments) {
      stats.totalAppointments++

      switch (apt.status) {
        case 'pending':
          stats.pendingAppointments++
          break
        case 'confirmed':
          stats.confirmedAppointments++
          break
        case 'completed':
          stats.completedAppointments++
          break
      }

      const aptDate = new Date(apt.scheduled_at)
      if (aptDate >= today && aptDate < tomorrow) {
        stats.upcomingToday++
      }

      // Calcular ingresos del mes (solo citas completadas)
      if (apt.status === 'completed' && aptDate >= startOfMonth && aptDate <= endOfMonth) {
        const appointmentType = apt.appointment_type as unknown as { price: number } | null
        const price = appointmentType?.price || 0
        stats.monthlyRevenue += price
      }
    }

    return stats
  },

  async getUpcomingAppointments(
    userId: string,
    role: 'client' | 'lawyer',
    limit = 5
  ): Promise<AppointmentWithRelations[]> {
    const supabase = createClient()

    let entityId: string | null = null

    if (role === 'client') {
      const { data } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .single()
      entityId = data?.id || null
    } else {
      const { data } = await supabase
        .from('lawyers')
        .select('id')
        .eq('user_id', userId)
        .single()
      entityId = data?.id || null
    }

    if (!entityId) return []

    const column = role === 'client' ? 'client_id' : 'lawyer_id'
    const now = new Date().toISOString()

    const { data } = await supabase
      .from('appointments')
      .select(`
        *,
        client:clients(*, profile:profiles(*)),
        lawyer:lawyers(*, profile:profiles(*)),
        appointment_type:appointment_types(*)
      `)
      .eq(column, entityId)
      .gte('scheduled_at', now)
      .in('status', ['pending', 'confirmed'])
      .order('scheduled_at', { ascending: true })
      .limit(limit)

    return (data || []) as AppointmentWithRelations[]
  },

  async getAdminStats(): Promise<AdminDashboardStats> {
    const supabase = createClient()

    // Get all lawyers with profiles
    const { data: lawyers } = await supabase
      .from('lawyers')
      .select('id, is_active, rating, user_id, profile:profiles(full_name)')

    // Get all clients count
    const { count: totalClients } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })

    // Get all appointments with types
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, status, scheduled_at, lawyer_id, appointment_type:appointment_types(price)')

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    // Calculate lawyer analytics
    const lawyerMap = new Map<string, LawyerAnalytics>()

    for (const lawyer of lawyers || []) {
      const profile = Array.isArray(lawyer.profile) ? lawyer.profile[0] : lawyer.profile
      lawyerMap.set(lawyer.id, {
        id: lawyer.id,
        name: profile?.full_name || 'Sin nombre',
        totalAppointments: 0,
        completedAppointments: 0,
        pendingAppointments: 0,
        monthlyRevenue: 0,
        averageRating: lawyer.rating || 0
      })
    }

    let totalMonthlyRevenue = 0
    let pendingAppointments = 0
    let todayAppointments = 0

    for (const apt of appointments || []) {
      const lawyerStats = lawyerMap.get(apt.lawyer_id)
      if (lawyerStats) {
        lawyerStats.totalAppointments++

        if (apt.status === 'pending') {
          lawyerStats.pendingAppointments++
          pendingAppointments++
        } else if (apt.status === 'completed' || apt.status === 'paid') {
          lawyerStats.completedAppointments++
        }

        const aptDate = new Date(apt.scheduled_at)
        if (aptDate >= today && aptDate < tomorrow) {
          todayAppointments++
        }

        // Monthly revenue calculation
        if ((apt.status === 'completed' || apt.status === 'paid') &&
            aptDate >= startOfMonth && aptDate <= endOfMonth) {
          const appointmentType = apt.appointment_type as unknown as { price: number } | null
          const price = appointmentType?.price || 0
          lawyerStats.monthlyRevenue += price
          totalMonthlyRevenue += price
        }
      }
    }

    // Sort lawyers by revenue (top earners first)
    const lawyerAnalytics = Array.from(lawyerMap.values())
      .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue)

    return {
      totalLawyers: lawyers?.length || 0,
      activeLawyers: lawyers?.filter(l => l.is_active).length || 0,
      totalClients: totalClients || 0,
      totalAppointments: appointments?.length || 0,
      monthlyRevenue: totalMonthlyRevenue,
      pendingAppointments,
      todayAppointments,
      lawyerAnalytics
    }
  },

  async getAllUpcomingAppointments(limit = 10): Promise<AppointmentWithRelations[]> {
    const supabase = createClient()
    const now = new Date().toISOString()

    const { data } = await supabase
      .from('appointments')
      .select(`
        *,
        client:clients(id, user_id, full_name, email, phone, profile:profiles(*)),
        lawyer:lawyers(*, profile:profiles(*)),
        appointment_type:appointment_types(*)
      `)
      .gte('scheduled_at', now)
      .in('status', ['pending', 'confirmed'])
      .order('scheduled_at', { ascending: true })
      .limit(limit)

    return (data || []) as AppointmentWithRelations[]
  }
}
