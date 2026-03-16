'use client'

import { create } from 'zustand'

interface AgentStore {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}))
