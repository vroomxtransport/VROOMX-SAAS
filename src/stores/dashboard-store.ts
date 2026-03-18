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

// Row height = 80px. Heights tuned to minimize blank space inside cards.
const DEFAULT_LAYOUT: WidgetLayout[] = [
  { id: 'statCards', visible: true, grid: { x: 0, y: 0, w: 12, h: 1, minW: 6, minH: 1 } },
  { id: 'loadsPipeline', visible: true, grid: { x: 0, y: 1, w: 8, h: 4, minW: 4, minH: 3 } },
  { id: 'fleetPulse', visible: true, grid: { x: 8, y: 1, w: 4, h: 4, minW: 3, minH: 3 } },
  { id: 'revenueChart', visible: true, grid: { x: 0, y: 5, w: 8, h: 5, minW: 4, minH: 3 } },
  { id: 'upcomingPickups', visible: true, grid: { x: 8, y: 5, w: 4, h: 5, minW: 3, minH: 3 } },
  { id: 'activityFeed', visible: true, grid: { x: 0, y: 10, w: 6, h: 5, minW: 4, minH: 3 } },
  { id: 'openInvoices', visible: true, grid: { x: 6, y: 10, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'topDrivers', visible: true, grid: { x: 9, y: 10, w: 3, h: 3, minW: 3, minH: 2 } },
  { id: 'quickLinks', visible: true, grid: { x: 0, y: 15, w: 4, h: 3, minW: 3, minH: 2 } },
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
      version: 7,
      partialize: (state) => ({ widgetLayout: state.widgetLayout }),
      migrate: (persisted, version) => {
        if (version < 7) {
          // Reset to defaults — v7: retuned heights for 80px row height
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
