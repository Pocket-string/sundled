'use client'

import { Card } from '@/components/ui/card'
import type { DashboardStats as Stats } from '../services/dashboardService'

interface DashboardStatsProps {
  stats: Stats
  userRole: 'client' | 'lawyer'
}

export function DashboardStats({ stats, userRole }: DashboardStatsProps) {
  const cards = [
    {
      title: 'Citas Hoy',
      value: stats.upcomingToday,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'bg-primary-500',
      bgColor: 'bg-primary-50'
    },
    {
      title: 'Pendientes',
      value: stats.pendingAppointments,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-warning-500',
      bgColor: 'bg-warning-50'
    },
    {
      title: 'Confirmadas',
      value: stats.confirmedAppointments,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-success-500',
      bgColor: 'bg-success-50'
    },
    {
      title: userRole === 'lawyer' ? 'Ingresos del Mes' : 'Completadas',
      value: userRole === 'lawyer' ? `$${stats.monthlyRevenue.toLocaleString()}` : stats.completedAppointments,
      icon: userRole === 'lawyer' ? (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      color: 'bg-secondary-500',
      bgColor: 'bg-secondary-50'
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <Card key={index} className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-foreground-secondary">{card.title}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{card.value}</p>
            </div>
            <div className={`${card.bgColor} ${card.color.replace('bg-', 'text-')} p-2 rounded-lg`}>
              {card.icon}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
