import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WidgetId = 'statCards' | 'loadsPipeline' | 'revenueChart' | 'fleetPulse' | 'upcomingPickups' | 'activityFeed'

export interface WidgetLayout {
  id: WidgetId
  order: number
  visible: boolean
}

const DEFAULT_LAYOUT: WidgetLayout[] = [
  { id: 'statCards', order: 0, visible: true },
  { id: 'loadsPipeline', order: 1, visible: true },
  { id: 'fleetPulse', order: 2, visible: true },
  { id: 'revenueChart', order: 3, visible: true },
  { id: 'upcomingPickups', order: 4, visible: true },
  { id: 'activityFeed', order: 5, visible: true },
]

interface DashboardStore {
  widgetLayout: WidgetLayout[]
  editMode: boolean
  toggleWidget: (id: WidgetId) => void
  reorderWidgets: (newLayout: WidgetLayout[]) => void
  setEditMode: (enabled: boolean) => void
  resetDefaults: () => void
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      widgetLayout: DEFAULT_LAYOUT.map((w) => ({ ...w })),
      editMode: false,
      toggleWidget: (id) =>
        set((state) => ({
          widgetLayout: state.widgetLayout.map((w) =>
            w.id === id ? { ...w, visible: !w.visible } : w
          ),
        })),
      reorderWidgets: (newLayout) => set({ widgetLayout: newLayout }),
      setEditMode: (enabled) => set({ editMode: enabled }),
      resetDefaults: () =>
        set({
          widgetLayout: DEFAULT_LAYOUT.map((w) => ({ ...w })),
          editMode: false,
        }),
    }),
    {
      name: 'vroomx-dashboard',
      version: 2,
      partialize: (state) => ({ widgetLayout: state.widgetLayout }),
      migrate: (persisted, version) => {
        if (version === 0 || version === 1) {
          // Migrate from old { visibleWidgets: Record<WidgetId, boolean> } format
          const old = persisted as { visibleWidgets?: Record<WidgetId, boolean> }
          if (old.visibleWidgets) {
            const widgetLayout = DEFAULT_LAYOUT.map((w) => ({
              ...w,
              visible: old.visibleWidgets![w.id] ?? w.visible,
            }))
            return { widgetLayout }
          }
        }
        return persisted as { widgetLayout: WidgetLayout[] }
      },
    }
  )
)

/** Returns visible widgets sorted by order, excluding statCards (which are always fixed at top). */
export function useOrderedVisibleWidgets() {
  const widgetLayout = useDashboardStore((s) => s.widgetLayout)
  return widgetLayout
    .filter((w) => w.id !== 'statCards' && w.visible)
    .sort((a, b) => a.order - b.order)
}
