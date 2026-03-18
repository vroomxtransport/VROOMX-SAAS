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

// rowHeight=1px — each h unit = 1 pixel for free-form resizing.
const DEFAULT_LAYOUT: WidgetLayout[] = [
  { id: 'statCards', visible: true, grid: { x: 0, y: 0, w: 12, h: 80, minW: 6, minH: 60 } },
  { id: 'loadsPipeline', visible: true, grid: { x: 0, y: 92, w: 8, h: 340, minW: 4, minH: 160 } },
  { id: 'fleetPulse', visible: true, grid: { x: 8, y: 92, w: 4, h: 340, minW: 3, minH: 160 } },
  { id: 'revenueChart', visible: true, grid: { x: 0, y: 444, w: 8, h: 420, minW: 4, minH: 200 } },
  { id: 'upcomingPickups', visible: true, grid: { x: 8, y: 444, w: 4, h: 420, minW: 3, minH: 200 } },
  { id: 'activityFeed', visible: true, grid: { x: 0, y: 876, w: 6, h: 420, minW: 4, minH: 200 } },
  { id: 'openInvoices', visible: true, grid: { x: 6, y: 876, w: 3, h: 240, minW: 3, minH: 120 } },
  { id: 'topDrivers', visible: true, grid: { x: 9, y: 876, w: 3, h: 240, minW: 3, minH: 120 } },
  { id: 'quickLinks', visible: true, grid: { x: 0, y: 1308, w: 4, h: 200, minW: 3, minH: 120 } },
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
      version: 8,
      partialize: (state) => ({ widgetLayout: state.widgetLayout }),
      migrate: (persisted, version) => {
        if (version < 8) {
          // Reset to defaults — v8: 1px row height for free-form resize
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
