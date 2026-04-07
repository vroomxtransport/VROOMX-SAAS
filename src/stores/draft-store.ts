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

/**
 * Field names that must NEVER be persisted to localStorage.
 *
 * M9 fix — drafts are persisted across reloads via localStorage, which is
 * accessible to any XSS or compromised browser extension. Sensitive fields
 * are stripped before persistence so a successful XSS cannot exfiltrate
 * SSNs, license numbers, banking info, or auth secrets out of the draft
 * store. The fields are matched case-insensitively against both
 * snake_case and camelCase variants.
 *
 * The list is intentionally permissive — better to drop a field that
 * isn't actually sensitive than to leak one that is.
 */
const SCRUB_FIELD_PATTERNS: readonly RegExp[] = [
  /^ssn$/i,
  /social[_-]?security/i,
  /^dob$/i,
  /date[_-]?of[_-]?birth/i,
  /birth[_-]?date/i,
  /license[_-]?(number|num|no)?$/i,
  /driver[_-]?license/i,
  /passport[_-]?(number|num|no)?$/i,
  /tax[_-]?id/i,
  /ein$/i,
  /bank[_-]?account/i,
  /account[_-]?number/i,
  /routing[_-]?number/i,
  /credit[_-]?card/i,
  /^cvv$/i,
  /^cvc$/i,
  /^password$/i,
  /^secret$/i,
  /^token$/i,
  /api[_-]?key/i,
  // Auction lot pickup PINs (e.g. order.auctionPin) — credentials used
  // to identify the legitimate puller at the lot. Not financial, but
  // they grant pickup access and shouldn't survive a browser session.
  /^pin$/i,
  /[A-Za-z]pin$/i,
  /pin[_-]?(code|number|num)?$/i,
]

function isSensitiveKey(key: string): boolean {
  return SCRUB_FIELD_PATTERNS.some((pattern) => pattern.test(key))
}

/**
 * Recursively strip sensitive fields from a value before persisting.
 * Walks plain objects and arrays; leaves primitives untouched.
 */
function scrubSensitive(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(scrubSensitive)
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) continue
    result[key] = scrubSensitive(val)
  }
  return result
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
          const { [key]: _removed, ...rest } = state.drafts
          return { drafts: rest }
        }),
      hasDraft: (key) => key in get().drafts,
    }),
    {
      name: 'vroomx-drafts',
      storage: createJSONStorage(() => localStorage),
      // M9: scrub sensitive fields from every draft before writing to
      // localStorage. The in-memory store still holds the full data so
      // the active form session works normally; only the persisted snapshot
      // is sanitized.
      partialize: (state) => ({
        drafts: Object.fromEntries(
          Object.entries(state.drafts).map(([key, draft]) => [
            key,
            scrubSensitive(draft) as DraftEntry,
          ])
        ),
      }),
    }
  )
)
