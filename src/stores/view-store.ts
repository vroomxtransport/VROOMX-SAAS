import { useState, useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ViewSection = 'drivers' | 'trucks' | 'orders' | 'tasks' | 'local-drives' | 'fuel' | 'maintenance' | 'compliance' | 'dispatchers'

interface ViewStore {
  views: Record<ViewSection, 'grid' | 'list'>
  setView: (section: ViewSection, mode: 'grid' | 'list') => void
}

export const useViewStore = create<ViewStore>()(
  persist(
    (set) => ({
      views: {
        drivers: 'grid',
        trucks: 'grid',
        orders: 'grid',
        tasks: 'list',
        'local-drives': 'list',
        fuel: 'list',
        maintenance: 'list',
        compliance: 'list',
        dispatchers: 'grid',
      },
      setView: (section, mode) =>
        set((state) => ({
          views: { ...state.views, [section]: mode },
        })),
    }),
    {
      name: 'vroomx-views',
    }
  )
)

/** Hydration-safe hook — returns default 'grid' during SSR, then persisted value after mount */
export function useViewMode(section: ViewSection): 'grid' | 'list' {
  const mode = useViewStore((s) => s.views[section])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return hydrated ? mode : 'grid'
}
