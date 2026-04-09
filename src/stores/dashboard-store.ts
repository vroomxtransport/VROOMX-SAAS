import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Layout, LayoutItem } from 'react-grid-layout'
import type { DashboardView, WidgetId } from '@/app/(dashboard)/dashboard/_lib/resolve-view'

export type { DashboardView, WidgetId }

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

// ---------------------------------------------------------------------------
// Default layouts per view
// ---------------------------------------------------------------------------

const DISPATCHER_LAYOUT: WidgetLayout[] = [
  { id: 'statCards',          visible: true,  grid: { x: 0, y: 0,  w: 12, h: 2,  minW: 6, minH: 2 } },
  { id: 'loadsPipeline',     visible: true,  grid: { x: 0, y: 0,  w: 8,  h: 8,  minW: 4, minH: 4 } },
  { id: 'fleetPulse',        visible: true,  grid: { x: 8, y: 0,  w: 4,  h: 8,  minW: 3, minH: 4 } },
  { id: 'upcomingPickups',   visible: true,  grid: { x: 0, y: 8,  w: 6,  h: 9,  minW: 3, minH: 5 } },
  { id: 'dispatchEfficiency', visible: true, grid: { x: 6, y: 8,  w: 6,  h: 9,  minW: 3, minH: 4 } },
  { id: 'activityFeed',      visible: true,  grid: { x: 0, y: 17, w: 6,  h: 9,  minW: 4, minH: 5 } },
  { id: 'topDrivers',        visible: true,  grid: { x: 6, y: 17, w: 6,  h: 9,  minW: 3, minH: 3 } },
  { id: 'quickLinks',        visible: true,  grid: { x: 0, y: 26, w: 4,  h: 7,  minW: 3, minH: 6 } },
]

const ACCOUNTING_LAYOUT: WidgetLayout[] = [
  { id: 'statCards',               visible: true,  grid: { x: 0, y: 0,  w: 12, h: 2,  minW: 6, minH: 2 } },
  { id: 'openInvoices',            visible: true,  grid: { x: 0, y: 0,  w: 4,  h: 8,  minW: 3, minH: 4 } },
  { id: 'arAgingChart',            visible: true,  grid: { x: 4, y: 0,  w: 8,  h: 8,  minW: 4, minH: 4 } },
  { id: 'revenueChart',            visible: true,  grid: { x: 0, y: 8,  w: 8,  h: 10, minW: 4, minH: 5 } },
  { id: 'paymentStatusBreakdown',  visible: true,  grid: { x: 8, y: 8,  w: 4,  h: 10, minW: 3, minH: 4 } },
  { id: 'recentPayments',          visible: true,  grid: { x: 0, y: 18, w: 8,  h: 9,  minW: 4, minH: 5 } },
  { id: 'quickLinks',              visible: true,  grid: { x: 8, y: 18, w: 4,  h: 7,  minW: 3, minH: 6 } },
]

const OWNER_LAYOUT: WidgetLayout[] = [
  { id: 'statCards',           visible: true, grid: { x: 0, y: 0,  w: 12, h: 2,  minW: 6, minH: 2 } },
  { id: 'revenueChart',       visible: true, grid: { x: 0, y: 0,  w: 8,  h: 10, minW: 4, minH: 5 } },
  { id: 'pnlSummary',         visible: true, grid: { x: 8, y: 0,  w: 4,  h: 10, minW: 3, minH: 4 } },
  { id: 'loadsPipeline',      visible: true, grid: { x: 0, y: 10, w: 6,  h: 8,  minW: 4, minH: 4 } },
  { id: 'openInvoices',       visible: true, grid: { x: 6, y: 10, w: 3,  h: 8,  minW: 3, minH: 3 } },
  { id: 'fleetPulse',         visible: true, grid: { x: 9, y: 10, w: 3,  h: 8,  minW: 3, minH: 4 } },
  { id: 'brokerScorecardMini', visible: true, grid: { x: 0, y: 18, w: 4,  h: 9, minW: 3, minH: 4 } },
  { id: 'revenueForecast',    visible: true, grid: { x: 4, y: 18, w: 4,  h: 9,  minW: 3, minH: 4 } },
  { id: 'topDrivers',         visible: true, grid: { x: 8, y: 18, w: 4,  h: 9,  minW: 3, minH: 3 } },
  { id: 'activityFeed',       visible: true, grid: { x: 0, y: 27, w: 6,  h: 9,  minW: 4, minH: 5 } },
  { id: 'upcomingPickups',    visible: true, grid: { x: 6, y: 27, w: 6,  h: 9,  minW: 3, minH: 5 } },
  { id: 'quickLinks',         visible: true, grid: { x: 0, y: 36, w: 4,  h: 7,  minW: 3, minH: 6 } },
]

export const VIEW_LAYOUTS: Record<DashboardView, WidgetLayout[]> = {
  dispatcher: DISPATCHER_LAYOUT,
  accounting: ACCOUNTING_LAYOUT,
  owner: OWNER_LAYOUT,
}

function cloneLayout(layout: WidgetLayout[]): WidgetLayout[] {
  return layout.map((w) => ({ ...w, grid: { ...w.grid } }))
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface DashboardStore {
  /** Per-view customized layouts (persisted). */
  viewLayouts: Record<DashboardView, WidgetLayout[]>
  /** The view currently being displayed. */
  activeView: DashboardView
  editMode: boolean
  toggleWidget: (id: WidgetId) => void
  setGridLayout: (layout: Layout) => void
  setEditMode: (enabled: boolean) => void
  resetDefaults: () => void
  /** Called by the server-rendered page to sync the store with the resolved view. */
  initializeForView: (view: DashboardView) => void
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      viewLayouts: {
        dispatcher: cloneLayout(DISPATCHER_LAYOUT),
        accounting: cloneLayout(ACCOUNTING_LAYOUT),
        owner: cloneLayout(OWNER_LAYOUT),
      },
      activeView: 'owner',
      editMode: false,

      initializeForView: (view: DashboardView) =>
        set((state) => {
          // If no stored layout for this view, seed with defaults
          const existing = state.viewLayouts[view]
          if (!existing || existing.length === 0) {
            return {
              activeView: view,
              viewLayouts: {
                ...state.viewLayouts,
                [view]: cloneLayout(VIEW_LAYOUTS[view]),
              },
            }
          }
          return { activeView: view }
        }),

      toggleWidget: (id) =>
        set((state) => {
          const view = state.activeView
          return {
            viewLayouts: {
              ...state.viewLayouts,
              [view]: state.viewLayouts[view].map((w) =>
                w.id === id ? { ...w, visible: !w.visible } : w
              ),
            },
          }
        }),

      setGridLayout: (layout: Layout) =>
        set((state) => {
          const view = state.activeView
          return {
            viewLayouts: {
              ...state.viewLayouts,
              [view]: state.viewLayouts[view].map((w) => {
                if (!w.visible || w.id === 'statCards') return w
                const rgl = layout.find((l: LayoutItem) => l.i === w.id)
                if (!rgl) return w
                return {
                  ...w,
                  grid: { ...w.grid, x: rgl.x, y: rgl.y, w: rgl.w, h: rgl.h },
                }
              }),
            },
          }
        }),

      setEditMode: (enabled) => set({ editMode: enabled }),

      resetDefaults: () =>
        set((state) => ({
          viewLayouts: {
            ...state.viewLayouts,
            [state.activeView]: cloneLayout(VIEW_LAYOUTS[state.activeView]),
          },
          editMode: false,
        })),
    }),
    {
      name: 'vroomx-dashboard',
      version: 11,
      partialize: (state) => ({
        viewLayouts: state.viewLayouts,
        activeView: state.activeView,
      }),
      migrate: (persisted, version) => {
        if (version < 11) {
          // v10→v11: switch from single layout to per-view layouts
          return {
            viewLayouts: {
              dispatcher: cloneLayout(DISPATCHER_LAYOUT),
              accounting: cloneLayout(ACCOUNTING_LAYOUT),
              owner: cloneLayout(OWNER_LAYOUT),
            },
            activeView: 'owner' as DashboardView,
          }
        }
        return persisted as {
          viewLayouts: Record<DashboardView, WidgetLayout[]>
          activeView: DashboardView
        }
      },
    }
  )
)

/** Returns the widget layout for the active view. */
export function useActiveViewLayout() {
  return useDashboardStore((s) => s.viewLayouts[s.activeView])
}

/** Returns visible widgets for the active view (excluding statCards). */
export function useVisibleWidgets() {
  const layout = useActiveViewLayout()
  return layout.filter((w) => w.id !== 'statCards' && w.visible)
}
