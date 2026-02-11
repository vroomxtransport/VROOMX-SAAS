import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface DraftEntry {
  [key: string]: unknown
  _savedAt: number
}

interface DraftStore {
  drafts: Record<string, DraftEntry>
  saveDraft: (key: string, data: Record<string, unknown>) => void
  loadDraft: (key: string) => DraftEntry | null
  clearDraft: (key: string) => void
  hasDraft: (key: string) => boolean
}

export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      drafts: {},
      saveDraft: (key, data) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [key]: { ...data, _savedAt: Date.now() },
          },
        })),
      loadDraft: (key) => get().drafts[key] ?? null,
      clearDraft: (key) =>
        set((state) => {
          const { [key]: _, ...rest } = state.drafts
          return { drafts: rest }
        }),
      hasDraft: (key) => key in get().drafts,
    }),
    {
      name: 'vroomx-drafts',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
