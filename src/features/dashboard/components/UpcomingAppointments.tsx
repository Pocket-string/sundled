'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { AppointmentWithRelations } from '@/types/database'

interface UpcomingAppointmentsProps {
  appointments: AppointmentWithRelations[]
  userRole: 'client' | 'lawyer'
}

export function UpcomingAppointments({ appointments, userRole }: UpcomingAppointmentsProps) {
  if (appointments.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-4">Próximas Citas</h3>
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-foreground-secondary">No tienes citas próximas</p>
          {userRole === 'client' && (
            <Link href="/appointments/new">
              <Button size="sm" className="mt-4">
                Agendar Cita
              </Button>
            </Link>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Próximas Citas</h3>
        <Link href="/appointments">
          <Button variant="ghost" size="sm">
            Ver todas
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {appointments.map((appointment) => {
          const date = new Date(appointment.scheduled_at)
          const person = userRole === 'client' ? appointment.lawyer : appointment.client
          const personName = person?.profile?.full_name || 'Sin nombre'
          const personInitial = personName.charAt(0).toUpperCase()

          return (
            <Link
              key={appointment.id}
              href={`/appointments/${appointment.id}`}
              className="block"
            >
              <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-medium">
                  {personInitial}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">
                      {personName}
                    </p>
                    <Badge
                      variant={appointment.status === 'confirmed' ? 'confirmed' : 'pending'}
                      className="flex-shrink-0"
                    >
                      {appointment.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground-secondary">
                    {appointment.appointment_type?.name}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {date.toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short'
                    })}
                  </p>
                  <p className="text-sm text-foreground-muted">
                    {date.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}
