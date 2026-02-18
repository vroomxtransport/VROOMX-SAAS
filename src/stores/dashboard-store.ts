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

const DEFAULT_LAYOUT: WidgetLayout[] = [
  { id: 'statCards', visible: true, grid: { x: 0, y: 0, w: 12, h: 1, minW: 6, minH: 1 } },
  { id: 'loadsPipeline', visible: true, grid: { x: 0, y: 1, w: 8, h: 3, minW: 4, minH: 2 } },
  { id: 'fleetPulse', visible: true, grid: { x: 8, y: 1, w: 4, h: 3, minW: 3, minH: 2 } },
  { id: 'revenueChart', visible: true, grid: { x: 0, y: 4, w: 8, h: 3, minW: 4, minH: 2 } },
  { id: 'upcomingPickups', visible: true, grid: { x: 8, y: 4, w: 4, h: 3, minW: 3, minH: 2 } },
  { id: 'activityFeed', visible: true, grid: { x: 0, y: 7, w: 12, h: 3, minW: 4, minH: 2 } },
  { id: 'openInvoices', visible: false, grid: { x: 0, y: 10, w: 6, h: 3, minW: 3, minH: 2 } },
  { id: 'topDrivers', visible: false, grid: { x: 6, y: 10, w: 6, h: 3, minW: 3, minH: 2 } },
  { id: 'quickLinks', visible: false, grid: { x: 0, y: 13, w: 4, h: 3, minW: 3, minH: 2 } },
]

// Span-to-grid migration defaults (maps old discrete spans to grid width)
const SPAN_TO_W: Record<number, number> = { 4: 4, 6: 6, 8: 8, 12: 12 }

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
      version: 4,
      partialize: (state) => ({ widgetLayout: state.widgetLayout }),
      migrate: (persisted, version) => {
        if (version === 0 || version === 1) {
          // Very old format — use defaults
          return { widgetLayout: DEFAULT_LAYOUT.map((w) => ({ ...w, grid: { ...w.grid } })) }
        }
        if (version === 2) {
          // v2: { id, order, visible } — no span, no grid
          const old = persisted as { widgetLayout: Array<{ id: string; order: number; visible: boolean }> }
          const existingIds = new Set(old.widgetLayout.map((w) => w.id))
          const migrated: WidgetLayout[] = old.widgetLayout.map((w) => {
            const def = DEFAULT_LAYOUT.find((d) => d.id === w.id)
            return {
              id: w.id as WidgetId,
              visible: w.visible,
              grid: def ? { ...def.grid } : { x: 0, y: 99, w: 12, h: 3, minW: 3, minH: 2 },
            }
          })
          for (const def of DEFAULT_LAYOUT) {
            if (!existingIds.has(def.id)) {
              migrated.push({ ...def, grid: { ...def.grid } })
            }
          }
          return { widgetLayout: migrated }
        }
        if (version === 3) {
          // v3: { id, order, visible, span } — convert span to grid
          const old = persisted as {
            widgetLayout: Array<{ id: string; order: number; visible: boolean; span: number }>
          }
          const existingIds = new Set(old.widgetLayout.map((w) => w.id))
          // Sort by order to assign y positions
          const sorted = [...old.widgetLayout].sort((a, b) => a.order - b.order)
          let currentY = 0
          let currentX = 0
          const migrated: WidgetLayout[] = sorted.map((w) => {
            const gridW = SPAN_TO_W[w.span] ?? 12
            // If it doesn't fit on current row, move to next
            if (currentX + gridW > 12) {
              currentY += 3
              currentX = 0
            }
            const def = DEFAULT_LAYOUT.find((d) => d.id === w.id)
            const pos: WidgetGridPos = {
              x: currentX,
              y: currentY,
              w: gridW,
              h: def?.grid.h ?? 3,
              minW: def?.grid.minW ?? 3,
              minH: def?.grid.minH ?? 2,
            }
            currentX += gridW
            if (currentX >= 12) {
              currentY += 3
              currentX = 0
            }
            return { id: w.id as WidgetId, visible: w.visible, grid: pos }
          })
          for (const def of DEFAULT_LAYOUT) {
            if (!existingIds.has(def.id)) {
              migrated.push({ ...def, grid: { ...def.grid } })
            }
          }
          return { widgetLayout: migrated }
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
