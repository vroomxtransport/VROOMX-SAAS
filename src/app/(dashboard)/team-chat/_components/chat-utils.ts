import type { ChatMessage } from '@/types/database'

const AVATAR_COLORS = [
  'bg-orange-500',   // brand
  'bg-blue-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
] as const

const AVATAR_TEXT_COLORS = [
  'text-orange-500',
  'text-blue-500',
  'text-violet-500',
  'text-emerald-500',
  'text-amber-500',
  'text-rose-500',
  'text-cyan-500',
  'text-indigo-500',
] as const

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function getUserColor(userId: string): string {
  return AVATAR_COLORS[hashString(userId) % AVATAR_COLORS.length]
}

export function getUserTextColor(userId: string): string {
  return AVATAR_TEXT_COLORS[hashString(userId) % AVATAR_TEXT_COLORS.length]
}

export function getUserInitials(userName: string | null): string {
  if (!userName) return '?'
  const parts = userName.trim().split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()

  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = today.getTime() - dateDay.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

export function shouldGroupMessage(
  current: ChatMessage,
  previous: ChatMessage | undefined
): boolean {
  if (!previous) return false
  if (current.user_id !== previous.user_id) return false
  const diff =
    new Date(current.created_at).getTime() -
    new Date(previous.created_at).getTime()
  return diff < 5 * 60 * 1000
}

export function getDateKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
