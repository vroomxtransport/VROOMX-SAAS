import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
  isOpen: boolean
  isCollapsed: boolean
  collapsedCategories: string[]
  toggle: () => void
  open: () => void
  close: () => void
  toggleCollapse: () => void
  setCollapsed: (collapsed: boolean) => void
  toggleCategory: (label: string) => void
  expandCategory: (label: string) => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      isOpen: false,
      isCollapsed: false,
      collapsedCategories: [],
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggleCollapse: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: (collapsed: boolean) => set({ isCollapsed: collapsed }),
      toggleCategory: (label: string) =>
        set((state) => ({
          collapsedCategories: state.collapsedCategories.includes(label)
            ? state.collapsedCategories.filter((l) => l !== label)
            : [...state.collapsedCategories, label],
        })),
      expandCategory: (label: string) =>
        set((state) => ({
          collapsedCategories: state.collapsedCategories.filter((l) => l !== label),
        })),
    }),
    {
      name: 'vroomx-sidebar',
      partialize: (state) => ({
        isCollapsed: state.isCollapsed,
        collapsedCategories: state.collapsedCategories,
      }),
    }
  )
)
