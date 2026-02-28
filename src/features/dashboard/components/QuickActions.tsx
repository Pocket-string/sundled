'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'

interface QuickActionsProps {
  userRole: 'client' | 'lawyer'
}

export function QuickActions({ userRole }: QuickActionsProps) {
  const clientActions = [
    {
      title: 'Agendar Cita',
      description: 'Reserva una consulta legal',
      href: '/appointments/new',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      color: 'bg-primary-500'
    },
    {
      title: 'Ver Abogados',
      description: 'Explora nuestros profesionales',
      href: '/lawyers',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'bg-accent-500'
    },
    {
      title: 'Mis Citas',
      description: 'Administra tus reservas',
      href: '/appointments',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'bg-secondary-500'
    }
  ]

  const lawyerActions = [
    {
      title: 'Ver Agenda',
      description: 'Revisa tus citas del día',
      href: '/appointments',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'bg-primary-500'
    },
    {
      title: 'Mi Perfil',
      description: 'Actualiza tu información',
      href: '/profile',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      color: 'bg-accent-500'
    },
    {
      title: 'Horarios',
      description: 'Configura disponibilidad',
      href: '/availability',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-secondary-500'
    }
  ]

  const actions = userRole === 'lawyer' ? lawyerActions : clientActions

  return (
    <Card className="p-6">
      <h3 className="font-semibold text-foreground mb-4">Acciones Rápidas</h3>
      <div className="space-y-3">
        {actions.map((action, index) => (
          <Link
            key={index}
            href={action.href}
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all group"
          >
            <div className={`${action.color} text-white p-3 rounded-lg group-hover:scale-110 transition-transform flex-shrink-0`}>
              {action.icon}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground">{action.title}</p>
              <p className="text-sm text-foreground-secondary">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  )
}
