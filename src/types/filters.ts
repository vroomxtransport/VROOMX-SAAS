export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  field: string
  direction: SortDirection
}

export interface DateRange {
  from: string // ISO date string
  to: string // ISO date string
}

export type DatePreset = {
  label: string
  getValue: () => DateRange
}

export interface FilterOption {
  value: string
  label: string
  color?: string // for status pills (tailwind color class)
  count?: number // optional count badge
}

export type FilterType = 'search' | 'select' | 'multi-select' | 'status-pills' | 'date-range'

export interface EnhancedFilterConfig {
  key: string
  label: string
  type: FilterType
  options?: FilterOption[]
  placeholder?: string
  presets?: DatePreset[]
}

// Helper to create common date presets
export function getDatePresets(): DatePreset[] {
  return [
    {
      label: 'Today',
      getValue: () => {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        return { from: d.toISOString(), to: new Date().toISOString() }
      },
    },
    {
      label: 'Yesterday',
      getValue: () => {
        const from = new Date()
        from.setDate(from.getDate() - 1)
        from.setHours(0, 0, 0, 0)
        const to = new Date()
        to.setDate(to.getDate() - 1)
        to.setHours(23, 59, 59, 999)
        return { from: from.toISOString(), to: to.toISOString() }
      },
    },
    {
      label: 'Last 7 Days',
      getValue: () => {
        const from = new Date()
        from.setDate(from.getDate() - 7)
        from.setHours(0, 0, 0, 0)
        return { from: from.toISOString(), to: new Date().toISOString() }
      },
    },
    {
      label: 'This Month',
      getValue: () => {
        const from = new Date()
        from.setDate(1)
        from.setHours(0, 0, 0, 0)
        return { from: from.toISOString(), to: new Date().toISOString() }
      },
    },
    {
      label: 'Last Month',
      getValue: () => {
        const from = new Date()
        from.setMonth(from.getMonth() - 1, 1)
        from.setHours(0, 0, 0, 0)
        const to = new Date()
        to.setDate(0)
        to.setHours(23, 59, 59, 999)
        return { from: from.toISOString(), to: to.toISOString() }
      },
    },
    {
      label: 'This Quarter',
      getValue: () => {
        const now = new Date()
        const quarter = Math.floor(now.getMonth() / 3)
        const from = new Date(now.getFullYear(), quarter * 3, 1)
        return { from: from.toISOString(), to: new Date().toISOString() }
      },
    },
    {
      label: 'Year to Date',
      getValue: () => {
        const from = new Date(new Date().getFullYear(), 0, 1)
        return { from: from.toISOString(), to: new Date().toISOString() }
      },
    },
  ]
}
