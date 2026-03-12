import type { ReactNode } from 'react'

interface BentoGridProps {
  children: ReactNode
  className?: string
  cols?: 2 | 3 | 4
}

export function BentoGrid({ children, className = '', cols = 4 }: BentoGridProps) {
  const colsClass = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }[cols]

  return (
    <div className={`grid ${colsClass} gap-4 ${className}`}>
      {children}
    </div>
  )
}
