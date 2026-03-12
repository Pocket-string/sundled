'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  plantId: string
}

const tabs = [
  { label: 'Dashboard', path: 'dashboard' },
  { label: 'Ingestion', path: 'ingestion' },
  { label: 'Heatmap', path: 'heatmap' },
  { label: 'Settings', path: 'settings' },
]

export function PlantSubnav({ plantId }: Props) {
  const pathname = usePathname()

  return (
    <nav className="border-b border-gray-800 bg-gray-900/50 px-6 md:px-8">
      <div className="flex gap-1 -mb-px">
        {tabs.map(tab => {
          const href = `/plants/${plantId}/${tab.path}`
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={tab.path}
              href={href}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
