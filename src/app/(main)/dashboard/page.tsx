import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardStats } from '@/features/dashboard/components/DashboardStats'
import { UpcomingAppointments } from '@/features/dashboard/components/UpcomingAppointments'
import { QuickActions } from '@/features/dashboard/components/QuickActions'
import { AdminDashboard } from '@/features/dashboard/components/AdminDashboard'
import { dashboardService } from '@/features/dashboard/services/dashboardService'
import { OnboardingProvider } from '@/features/onboarding/components'

export const metadata = {
  title: 'Dashboard | LexAgenda'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obtener rol del usuario
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const userRole = (profile?.role as 'client' | 'lawyer' | 'admin') || 'client'
  const userName = profile?.full_name || user.email?.split('@')[0] || 'Usuario'

  const greeting = getGreeting()

  // Admin gets special dashboard
  if (userRole === 'admin') {
    const [adminStats, upcomingAppointments] = await Promise.all([
      dashboardService.getAdminStats(),
      dashboardService.getAllUpcomingAppointments(8)
    ])

    return (
      <>
        <OnboardingProvider userRole={userRole} userId={user.id} />
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {greeting}, {userName}
            </h1>
            <p className="text-foreground-secondary mt-1">
              Panel de administracion del bufete juridico
            </p>
          </div>
          <AdminDashboard stats={adminStats} upcomingAppointments={upcomingAppointments} />
        </div>
      </>
    )
  }

  // Regular user (client/lawyer) dashboard
  const [stats, upcomingAppointments] = await Promise.all([
    dashboardService.getStats(user.id, userRole as 'client' | 'lawyer'),
    dashboardService.getUpcomingAppointments(user.id, userRole as 'client' | 'lawyer', 5)
  ])

  return (
    <>
      {/* Onboarding Wizard */}
      <OnboardingProvider userRole={userRole} userId={user.id} />

      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting}, {userName}
          </h1>
          <p className="text-foreground-secondary mt-1">
            {userRole === 'lawyer'
              ? 'Aquí está el resumen de tu práctica legal'
              : 'Aquí está el resumen de tus consultas legales'}
          </p>
        </div>

        {/* Stats */}
        <DashboardStats stats={stats} userRole={userRole} />

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming appointments - takes 2 columns */}
          <div className="lg:col-span-2">
            <UpcomingAppointments
              appointments={upcomingAppointments}
              userRole={userRole}
            />
          </div>

          {/* Quick actions - takes 1 column */}
          <div>
            <QuickActions userRole={userRole} />
          </div>
        </div>
      </div>
    </>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}
