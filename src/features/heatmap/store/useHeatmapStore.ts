import { create } from 'zustand'

export type HeatmapMetric = 'class' | 'underperf_ratio' | 'p_string' | 'p_expected'

export interface HeatmapFilters {
  ct: string | null
  inverter: string | null
  severity: string | null // 'green' | 'blue' | 'orange' | 'red' | 'gray' | null (all)
  search: string
}

interface HeatmapState {
  metric: HeatmapMetric
  filters: HeatmapFilters
  selectedStringId: string | null
  hoveredStringId: string | null
  setMetric: (m: HeatmapMetric) => void
  setFilter: <K extends keyof HeatmapFilters>(key: K, value: HeatmapFilters[K]) => void
  clearFilters: () => void
  setSelected: (id: string | null) => void
  setHovered: (id: string | null) => void
}

const defaultFilters: HeatmapFilters = {
  ct: null,
  inverter: null,
  severity: null,
  search: '',
}

export const useHeatmapStore = create<HeatmapState>((set) => ({
  metric: 'class',
  filters: { ...defaultFilters },
  selectedStringId: null,
  hoveredStringId: null,
  setMetric: (metric) => set({ metric }),
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  clearFilters: () => set({ filters: { ...defaultFilters } }),
  setSelected: (selectedStringId) => set({ selectedStringId }),
  setHovered: (hoveredStringId) => set({ hoveredStringId }),
}))
