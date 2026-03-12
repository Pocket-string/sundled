import type { ReactNode } from 'react'

interface BentoCardProps {
  children: ReactNode
  className?: string
  span?: 'default' | 'wide' | 'tall' | 'hero'
  padding?: 'sm' | 'md' | 'lg'
}

export function BentoCard({ children, className = '', span = 'default', padding = 'md' }: BentoCardProps) {
  const spanClass = {
    default: '',
    wide: 'md:col-span-2',
    tall: 'md:row-span-2',
    hero: 'md:col-span-2 md:row-span-2',
  }[span]

  const paddingClass = {
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  }[padding]

  return (
    <div
      className={`rounded-2xl border border-gray-800/50 bg-gray-900/80 backdrop-blur-sm ${paddingClass} ${spanClass} ${className}`}
    >
      {children}
    </div>
  )
}
