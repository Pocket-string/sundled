'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LucviaLogo } from '@/components/LucviaLogo'

interface SidebarPlant {
  id: string
  name: string
  onboarding_status: string
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [plants, setPlants] = useState<SidebarPlant[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('plants')
      .select('id, name, onboarding_status')
      .order('name')
      .then(({ data }) => {
        if (data) setPlants(data)
      })
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isDashboardActive = pathname === '/dashboard'

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-40">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <LucviaLogo className="w-5 h-5" variant="emerald" />
        </div>
        <span className="text-lg font-bold text-white">Lucvia</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Dashboard */}
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isDashboardActive
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          Dashboard
        </Link>

        {/* Plants section */}
        <div className="pt-4">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plantas</span>
            <Link
              href="/plants/new"
              className="text-gray-500 hover:text-emerald-400 transition-colors"
              title="Nueva planta"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </Link>
          </div>

          {plants.length === 0 ? (
            <p className="px-3 text-xs text-gray-600">Sin plantas</p>
          ) : (
            <div className="space-y-0.5">
              {plants.map((plant) => {
                const isPlantActive = pathname.startsWith(`/plants/${plant.id}`)
                return (
                  <Link
                    key={plant.id}
                    href={`/plants/${plant.id}`}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isPlantActive
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      plant.onboarding_status === 'active' ? 'bg-emerald-400' :
                      plant.onboarding_status === 'ready_to_sync' ? 'bg-yellow-400' :
                      'bg-gray-600'
                    }`} />
                    <span className="truncate">{plant.name}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Cerrar sesion
        </button>
      </div>
    </aside>
  )
}
