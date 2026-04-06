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

export type DashboardRole = 'dispatcher' | 'owner' | 'accountant'

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
  { id: 'loadsPipeline', visible: true, grid: { x: 0, y: 0, w: 8, h: 8, minW: 4, minH: 4 } },
  { id: 'fleetPulse', visible: true, grid: { x: 8, y: 0, w: 4, h: 8, minW: 3, minH: 4 } },
  { id: 'revenueChart', visible: true, grid: { x: 0, y: 8, w: 8, h: 10, minW: 4, minH: 5 } },
  { id: 'upcomingPickups', visible: true, grid: { x: 8, y: 8, w: 4, h: 10, minW: 3, minH: 5 } },
  { id: 'activityFeed', visible: true, grid: { x: 0, y: 18, w: 6, h: 10, minW: 4, minH: 5 } },
  { id: 'openInvoices', visible: true, grid: { x: 6, y: 18, w: 3, h: 6, minW: 3, minH: 3 } },
  { id: 'topDrivers', visible: true, grid: { x: 9, y: 18, w: 3, h: 6, minW: 3, minH: 3 } },
  { id: 'quickLinks', visible: true, grid: { x: 0, y: 28, w: 4, h: 8, minW: 3, minH: 6 } },
]

// Dispatcher — operational focus: loads, pickups, fleet, activity
const DISPATCHER_LAYOUT: WidgetLayout[] = [
  { id: 'statCards',       visible: true,  grid: { x: 0, y: 0,  w: 12, h: 2,  minW: 6, minH: 2 } },
  { id: 'loadsPipeline',   visible: true,  grid: { x: 0, y: 0,  w: 8,  h: 9,  minW: 4, minH: 4 } },
  { id: 'fleetPulse',      visible: true,  grid: { x: 8, y: 0,  w: 4,  h: 9,  minW: 3, minH: 4 } },
  { id: 'upcomingPickups', visible: true,  grid: { x: 0, y: 9,  w: 6,  h: 9,  minW: 3, minH: 5 } },
  { id: 'activityFeed',    visible: true,  grid: { x: 6, y: 9,  w: 6,  h: 9,  minW: 4, minH: 5 } },
  { id: 'topDrivers',      visible: true,  grid: { x: 0, y: 18, w: 8,  h: 7,  minW: 3, minH: 3 } },
  { id: 'quickLinks',      visible: true,  grid: { x: 8, y: 18, w: 4,  h: 7,  minW: 3, minH: 6 } },
  { id: 'revenueChart',    visible: false, grid: { x: 0, y: 25, w: 8,  h: 10, minW: 4, minH: 5 } },
  { id: 'openInvoices',    visible: false, grid: { x: 8, y: 25, w: 4,  h: 6,  minW: 3, minH: 3 } },
]

// Owner/Admin — strategic focus: revenue, financials, full overview
const OWNER_LAYOUT: WidgetLayout[] = [
  { id: 'statCards',       visible: true, grid: { x: 0, y: 0,  w: 12, h: 2,  minW: 6, minH: 2 } },
  { id: 'revenueChart',    visible: true, grid: { x: 0, y: 0,  w: 8,  h: 10, minW: 4, minH: 5 } },
  { id: 'fleetPulse',      visible: true, grid: { x: 8, y: 0,  w: 4,  h: 10, minW: 3, minH: 4 } },
  { id: 'loadsPipeline',   visible: true, grid: { x: 0, y: 10, w: 6,  h: 8,  minW: 4, minH: 4 } },
  { id: 'openInvoices',    visible: true, grid: { x: 6, y: 10, w: 6,  h: 8,  minW: 3, minH: 3 } },
  { id: 'topDrivers',      visible: true, grid: { x: 0, y: 18, w: 4,  h: 7,  minW: 3, minH: 3 } },
  { id: 'upcomingPickups', visible: true, grid: { x: 4, y: 18, w: 4,  h: 7,  minW: 3, minH: 5 } },
  { id: 'activityFeed',    visible: true, grid: { x: 8, y: 18, w: 4,  h: 7,  minW: 4, minH: 5 } },
  { id: 'quickLinks',      visible: true, grid: { x: 0, y: 25, w: 4,  h: 7,  minW: 3, minH: 6 } },
]

// Accountant — financial focus: invoices, revenue, quick links
const ACCOUNTANT_LAYOUT: WidgetLayout[] = [
  { id: 'statCards',       visible: true,  grid: { x: 0, y: 0,  w: 12, h: 2,  minW: 6, minH: 2 } },
  { id: 'openInvoices',    visible: true,  grid: { x: 0, y: 0,  w: 8,  h: 10, minW: 3, minH: 3 } },
  { id: 'revenueChart',    visible: true,  grid: { x: 0, y: 10, w: 8,  h: 10, minW: 4, minH: 5 } },
  { id: 'quickLinks',      visible: true,  grid: { x: 8, y: 0,  w: 4,  h: 7,  minW: 3, minH: 6 } },
  { id: 'loadsPipeline',   visible: false, grid: { x: 0, y: 20, w: 8,  h: 8,  minW: 4, minH: 4 } },
  { id: 'fleetPulse',      visible: false, grid: { x: 8, y: 0,  w: 4,  h: 8,  minW: 3, minH: 4 } },
  { id: 'upcomingPickups', visible: false, grid: { x: 8, y: 8,  w: 4,  h: 10, minW: 3, minH: 5 } },
  { id: 'activityFeed',    visible: false, grid: { x: 0, y: 18, w: 6,  h: 10, minW: 4, minH: 5 } },
  { id: 'topDrivers',      visible: false, grid: { x: 6, y: 18, w: 6,  h: 6,  minW: 3, minH: 3 } },
]

export const ROLE_PRESETS: Record<DashboardRole, WidgetLayout[]> = {
  dispatcher: DISPATCHER_LAYOUT,
  owner: OWNER_LAYOUT,
  accountant: ACCOUNTANT_LAYOUT,
}

interface DashboardStore {
  widgetLayout: WidgetLayout[]
  editMode: boolean
  activePreset: DashboardRole | null
  toggleWidget: (id: WidgetId) => void
  setGridLayout: (layout: Layout) => void
  setEditMode: (enabled: boolean) => void
  resetDefaults: () => void
  applyRolePreset: (role: DashboardRole) => void
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      widgetLayout: DEFAULT_LAYOUT.map((w) => ({ ...w, grid: { ...w.grid } })),
      editMode: false,
      activePreset: null,
      toggleWidget: (id) =>
        set((state) => ({
          widgetLayout: state.widgetLayout.map((w) =>
            w.id === id ? { ...w, visible: !w.visible } : w
          ),
          // Any manual toggle breaks preset tracking
          activePreset: null,
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
          // Any drag/resize breaks preset tracking
          activePreset: null,
        })),
      setEditMode: (enabled) => set({ editMode: enabled }),
      resetDefaults: () =>
        set({
          widgetLayout: DEFAULT_LAYOUT.map((w) => ({ ...w, grid: { ...w.grid } })),
          editMode: false,
          activePreset: null,
        }),
      applyRolePreset: (role: DashboardRole) =>
        set({
          // eslint-disable-next-line security/detect-object-injection
          widgetLayout: ROLE_PRESETS[role].map((w) => ({ ...w, grid: { ...w.grid } })),
          editMode: false,
          activePreset: role,
        }),
    }),
    {
      name: 'vroomx-dashboard',
      version: 10,
      partialize: (state) => ({
        widgetLayout: state.widgetLayout,
        activePreset: state.activePreset,
      }),
      migrate: (persisted, version) => {
        if (version < 10) {
          // Reset to defaults — v10: role preset support added
          return {
            widgetLayout: DEFAULT_LAYOUT.map((w) => ({ ...w, grid: { ...w.grid } })),
            activePreset: null,
          }
        }
        return persisted as { widgetLayout: WidgetLayout[]; activePreset: DashboardRole | null }
      },
    }
  )
)

/** Returns visible widgets (excluding statCards, which renders above the grid). */
export function useVisibleWidgets() {
  const widgetLayout = useDashboardStore((s) => s.widgetLayout)
  return widgetLayout.filter((w) => w.id !== 'statCards' && w.visible)
}
