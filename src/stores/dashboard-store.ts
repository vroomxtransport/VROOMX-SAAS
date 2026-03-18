import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Layout, LayoutItem } from 'react-grid-layout'

export type WidgetId =
  | 'statCards'
  | 'loadsPipeline'
  | 'revenueChart'
  | 'fleetPulse'
  | 'upcomingPickups'
  | 'activityFeed'
  | 'openInvoices'
  | 'topDrivers'
  | 'quickLinks'

export interface WidgetGridPos {
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export interface WidgetLayout {
  id: WidgetId
  visible: boolean
  grid: WidgetGridPos
}

// rowHeight=40px — fine granularity (40px steps) with reliable compaction.
const DEFAULT_LAYOUT: WidgetLayout[] = [
  { id: 'statCards', visible: true, grid: { x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 } },
  { id: 'loadsPipeline', visible: true, grid: { x: 0, y: 2, w: 8, h: 8, minW: 4, minH: 4 } },
  { id: 'fleetPulse', visible: true, grid: { x: 8, y: 2, w: 4, h: 8, minW: 3, minH: 4 } },
  { id: 'revenueChart', visible: true, grid: { x: 0, y: 10, w: 8, h: 10, minW: 4, minH: 5 } },
  { id: 'upcomingPickups', visible: true, grid: { x: 8, y: 10, w: 4, h: 10, minW: 3, minH: 5 } },
  { id: 'activityFeed', visible: true, grid: { x: 0, y: 20, w: 6, h: 10, minW: 4, minH: 5 } },
  { id: 'openInvoices', visible: true, grid: { x: 6, y: 20, w: 3, h: 6, minW: 3, minH: 3 } },
  { id: 'topDrivers', visible: true, grid: { x: 9, y: 20, w: 3, h: 6, minW: 3, minH: 3 } },
  { id: 'quickLinks', visible: true, grid: { x: 0, y: 30, w: 4, h: 5, minW: 3, minH: 3 } },
]

interface DashboardStore {
  widgetLayout: WidgetLayout[]
  editMode: boolean
  toggleWidget: (id: WidgetId) => void
  setGridLayout: (layout: Layout) => void
  setEditMode: (enabled: boolean) => void
  resetDefaults: () => void
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      widgetLayout: DEFAULT_LAYOUT.map((w) => ({ ...w, grid: { ...w.grid } })),
      editMode: false,
      toggleWidget: (id) =>
        set((state) => ({
          widgetLayout: state.widgetLayout.map((w) =>
            w.id === id ? { ...w, visible: !w.visible } : w
          ),
        })),
      setGridLayout: (layout: Layout) =>
        set((state) => ({
          widgetLayout: state.widgetLayout.map((w) => {
            // Skip hidden widgets and statCards (rendered outside grid)
            if (!w.visible || w.id === 'statCards') return w
            const rgl = layout.find((l: LayoutItem) => l.i === w.id)
            if (!rgl) return w
            return {
              ...w,
              grid: {
                ...w.grid,
                x: rgl.x,
                y: rgl.y,
                w: rgl.w,
                h: rgl.h,
              },
            }
          }),
        })),
      setEditMode: (enabled) => set({ editMode: enabled }),
      resetDefaults: () =>
        set({
          widgetLayout: DEFAULT_LAYOUT.map((w) => ({ ...w, grid: { ...w.grid } })),
          editMode: false,
        }),
    }),
    {
      name: 'vroomx-dashboard',
      version: 9,
      partialize: (state) => ({ widgetLayout: state.widgetLayout }),
      migrate: (persisted, version) => {
        if (version < 9) {
          // Reset to defaults — v9: 40px row height for balanced granularity
          return { widgetLayout: DEFAULT_LAYOUT.map((w) => ({ ...w, grid: { ...w.grid } })) }
        }
        return persisted as { widgetLayout: WidgetLayout[] }
      },
    }
  )
)

/** Returns visible widgets (excluding statCards, which renders above the grid). */
export function useVisibleWidgets() {
  const widgetLayout = useDashboardStore((s) => s.widgetLayout)
  return widgetLayout.filter((w) => w.id !== 'statCards' && w.visible)
}
