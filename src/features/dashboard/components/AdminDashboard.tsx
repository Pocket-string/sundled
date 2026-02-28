'use client'

import { Card } from '@/components/ui/card'
import Link from 'next/link'
import type { AdminDashboardStats, LawyerAnalytics } from '../services/dashboardService'
import type { AppointmentWithRelations } from '@/types/database'

interface AdminDashboardProps {
  stats: AdminDashboardStats
  upcomingAppointments: AppointmentWithRelations[]
}

// Helper to get client name from profile or direct field (for guest clients)
const getClientName = (client: AppointmentWithRelations['client'] | undefined): string => {
  if (!client) return 'Cliente'
  return client.profile?.full_name || client.full_name || 'Cliente'
}

export function AdminDashboard({ stats, upcomingAppointments }: AdminDashboardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Abogados"
          value={stats.totalLawyers}
          subtitle={`${stats.activeLawyers} activos`}
          icon={<UsersIcon className="w-6 h-6 text-primary-500" />}
          color="primary"
        />
        <StatCard
          title="Total Clientes"
          value={stats.totalClients}
          subtitle="registrados"
          icon={<UserGroupIcon className="w-6 h-6 text-accent-500" />}
          color="accent"
        />
        <StatCard
          title="Citas Hoy"
          value={stats.todayAppointments}
          subtitle={`${stats.pendingAppointments} pendientes`}
          icon={<CalendarIcon className="w-6 h-6 text-warning-500" />}
          color="warning"
        />
        <StatCard
          title="Ingresos del Mes"
          value={formatCurrency(stats.monthlyRevenue)}
          subtitle={`${stats.totalAppointments} citas totales`}
          icon={<CurrencyIcon className="w-6 h-6 text-success-500" />}
          color="success"
          isLarge
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lawyer Analytics - Top Earners */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ChartIcon className="w-5 h-5 text-accent-500" />
                Rendimiento por Abogado
              </h2>
              <span className="text-xs text-foreground-secondary bg-gray-100 px-2 py-1 rounded-full">
                Este mes
              </span>
            </div>

            {stats.lawyerAnalytics.length > 0 ? (
              <div className="space-y-4">
                {stats.lawyerAnalytics.map((lawyer, index) => (
                  <LawyerRow
                    key={lawyer.id}
                    lawyer={lawyer}
                    rank={index + 1}
                    maxRevenue={stats.lawyerAnalytics[0]?.monthlyRevenue || 1}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-foreground-secondary">
                No hay abogados registrados
              </div>
            )}
          </Card>
        </div>

        {/* Upcoming Appointments */}
        <div>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-primary-500" />
                Proximas Citas
              </h2>
              <Link href="/calendar" className="text-sm text-accent-600 hover:underline">
                Ver todas
              </Link>
            </div>

            {upcomingAppointments.length > 0 ? (
              <div className="space-y-3">
                {upcomingAppointments.map(apt => (
                  <AppointmentCard key={apt.id} appointment={apt} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-foreground-secondary">
                No hay citas programadas
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Quick Actions for Admin */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Acciones Rapidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/calendar" className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <CalendarIcon className="w-8 h-8 text-primary-500" />
            <div>
              <p className="font-medium text-foreground">Calendario</p>
              <p className="text-xs text-foreground-secondary">Ver todas las citas</p>
            </div>
          </Link>
          <Link href="/lawyers" className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <UsersIcon className="w-8 h-8 text-accent-500" />
            <div>
              <p className="font-medium text-foreground">Abogados</p>
              <p className="text-xs text-foreground-secondary">Gestionar equipo</p>
            </div>
          </Link>
          <Link href="/appointments/new/admin" className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <PlusIcon className="w-8 h-8 text-success-500" />
            <div>
              <p className="font-medium text-foreground">Nueva Cita</p>
              <p className="text-xs text-foreground-secondary">Agendar para un abogado</p>
            </div>
          </Link>
          <Link href="/projects" className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <BriefcaseIcon className="w-8 h-8 text-warning-500" />
            <div>
              <p className="font-medium text-foreground">Proyectos</p>
              <p className="text-xs text-foreground-secondary">Ver casos activos</p>
            </div>
          </Link>
        </div>
      </Card>
    </div>
  )
}

// Sub-components
function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  isLarge = false
}: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ReactNode
  color: 'primary' | 'accent' | 'warning' | 'success'
  isLarge?: boolean
}) {
  const bgColors = {
    primary: 'bg-primary-50',
    accent: 'bg-accent-50',
    warning: 'bg-warning-50',
    success: 'bg-success-50'
  }

  return (
    <Card className={`p-4 ${bgColors[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-foreground-secondary">{title}</p>
          <p className={`font-bold text-foreground ${isLarge ? 'text-xl' : 'text-2xl'}`}>{value}</p>
          <p className="text-xs text-foreground-secondary mt-1">{subtitle}</p>
        </div>
        {icon}
      </div>
    </Card>
  )
}

function LawyerRow({
  lawyer,
  rank,
  maxRevenue,
  formatCurrency
}: {
  lawyer: LawyerAnalytics
  rank: number
  maxRevenue: number
  formatCurrency: (amount: number) => string
}) {
  const percentage = maxRevenue > 0 ? (lawyer.monthlyRevenue / maxRevenue) * 100 : 0
  const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
      <div className="w-8 h-8 flex items-center justify-center">
        {rank <= 3 ? (
          <span className={`text-xl ${medalColors[rank - 1]}`}>
            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
          </span>
        ) : (
          <span className="text-lg font-medium text-foreground-secondary">#{rank}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="font-medium text-foreground truncate">{lawyer.name}</p>
          <p className="font-semibold text-foreground">{formatCurrency(lawyer.monthlyRevenue)}</p>
        </div>

        <div className="flex items-center gap-4 text-xs text-foreground-secondary">
          <span>{lawyer.totalAppointments} citas</span>
          <span>{lawyer.completedAppointments} completadas</span>
          <span>⭐ {lawyer.averageRating.toFixed(1)}</span>
        </div>

        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-400 to-accent-600 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function AppointmentCard({ appointment }: { appointment: AppointmentWithRelations }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-warning-100 text-warning-700',
    confirmed: 'bg-success-100 text-success-700'
  }

  const date = new Date(appointment.scheduled_at)

  return (
    <Link
      href={`/appointments/${appointment.id}`}
      className="block p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground truncate">
            {getClientName(appointment.client)}
          </p>
          <p className="text-sm text-foreground-secondary">
            con {appointment.lawyer?.profile?.full_name || 'Abogado'}
          </p>
          <p className="text-xs text-foreground-secondary mt-1">
            {date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} -{' '}
            {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[appointment.status] || 'bg-gray-100 text-gray-700'}`}>
          {appointment.status === 'pending' ? 'Pendiente' : 'Confirmada'}
        </span>
      </div>
    </Link>
  )
}

// Icons
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function UserGroupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function CurrencyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}
