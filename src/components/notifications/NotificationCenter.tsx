'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import type { Notification, NotificationType } from '@/types/database'

interface NotificationCenterProps {
  userId: string
}

const NOTIFICATION_ICONS: Record<NotificationType, React.FC<{ className?: string }>> = {
  appointment_created: CalendarPlusIcon,
  appointment_confirmed: CheckCircleIcon,
  appointment_cancelled: XCircleIcon,
  appointment_reminder: BellIcon,
  payment_received: CurrencyIcon,
  case_update: DocumentIcon,
  document_request: FolderIcon,
}

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  appointment_created: 'bg-accent-100 text-accent-600',
  appointment_confirmed: 'bg-success-100 text-success-600',
  appointment_cancelled: 'bg-error-100 text-error-600',
  appointment_reminder: 'bg-warning-100 text-warning-600',
  payment_received: 'bg-secondary-100 text-secondary-600',
  case_update: 'bg-primary-100 text-primary-600',
  document_request: 'bg-purple-100 text-purple-600',
}

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const unreadCount = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    const fetchNotifications = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) {
        setNotifications(data)
      }
      setIsLoading(false)
    }

    fetchNotifications()

    // Subscribe to new notifications
    const supabase = createClient()
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const markAsRead = async (notificationId: string) => {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    )
  }

  const markAllAsRead = async () => {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `Hace ${minutes} min`
    if (hours < 24) return `Hace ${hours}h`
    if (days < 7) return `Hace ${days}d`
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <BellIcon className="w-6 h-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-error-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <Card className="fixed left-64 top-24 w-80 md:w-96 max-h-[480px] overflow-hidden z-50 shadow-xl animate-slide-down">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Notificaciones</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-accent-600 hover:text-accent-700"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto max-h-[360px]">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <BellIcon className="w-12 h-12 text-foreground-muted mx-auto mb-3" />
                  <p className="text-foreground-secondary">No tienes notificaciones</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map(notification => {
                    const Icon = NOTIFICATION_ICONS[notification.type]
                    const colorClass = NOTIFICATION_COLORS[notification.type]

                    return (
                      <button
                        key={notification.id}
                        onClick={() => markAsRead(notification.id)}
                        className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                          !notification.is_read ? 'bg-accent-50/50' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm ${notification.is_read ? 'text-foreground' : 'font-semibold text-foreground'}`}>
                                {notification.title}
                              </p>
                              {!notification.is_read && (
                                <span className="w-2 h-2 bg-accent-500 rounded-full flex-shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-sm text-foreground-secondary line-clamp-2 mt-0.5">
                              {notification.message}
                            </p>
                            <p className="text-xs text-foreground-muted mt-1">
                              {formatTime(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-border">
                <button className="w-full text-sm text-accent-600 hover:text-accent-700 font-medium">
                  Ver todas las notificaciones
                </button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

// Icons
function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function CalendarPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}
