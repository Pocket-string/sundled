'use client'

import { useContactStore } from '@/components/useContactStore'

interface Props {
  children: React.ReactNode
  className?: string
}

export function ContactTrigger({ children, className }: Props) {
  const open = useContactStore((s) => s.open)

  return (
    <button type="button" onClick={open} className={className}>
      {children}
    </button>
  )
}
