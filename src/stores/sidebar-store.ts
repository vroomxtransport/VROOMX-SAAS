import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
  isOpen: boolean
  isCollapsed: boolean
  toggle: () => void
  open: () => void
  close: () => void
  toggleCollapse: () => void
  setCollapsed: (collapsed: boolean) => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      isOpen: false,
      isCollapsed: false,
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggleCollapse: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: (collapsed: boolean) => set({ isCollapsed: collapsed }),
    }),
    {
      name: 'vroomx-sidebar',
      partialize: (state) => ({ isCollapsed: state.isCollapsed }),
    }
  )
)
