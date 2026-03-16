'use client'

import { useContactStore } from '@/components/useContactStore'
import { ContactModal } from '@/components/ContactModal'

export function ContactModalProvider() {
  const { isOpen, close } = useContactStore()
  return <ContactModal isOpen={isOpen} onClose={close} />
}
