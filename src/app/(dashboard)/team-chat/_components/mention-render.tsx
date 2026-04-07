import type { ReactNode } from 'react'
import type { ChatMention } from '@/types/database'

/**
 * Escape regex metacharacters so a display name like "John (Dispatch)"
 * can be used safely inside a RegExp.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Renders message content as React nodes, replacing each known @-mention
 * token (`@<displayName>`) with a styled span. Self-mentions get a brighter
 * accent. Returns the plain content as a single-element array if there are
 * no mentions.
 *
 * Sorts display names by length DESC so that overlapping names (e.g.
 * "@John" vs "@John Doe") resolve to the longest match.
 */
export function renderMessageContent(
  content: string,
  mentions: ChatMention[] | null,
  currentUserId: string
): ReactNode[] {
  if (!mentions || mentions.length === 0) {
    return [content]
  }

  const sorted = [...mentions].sort(
    (a, b) => b.displayName.length - a.displayName.length
  )

  const pattern = new RegExp(
    `@(?:${sorted.map((m) => escapeRegex(m.displayName)).join('|')})`,
    'g'
  )

  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0

  for (const match of content.matchAll(pattern)) {
    const matchStart = match.index ?? 0
    const matchText = match[0]
    const displayName = matchText.slice(1)

    const mention = sorted.find((m) => m.displayName === displayName)
    if (!mention) continue

    if (matchStart > lastIndex) {
      nodes.push(content.slice(lastIndex, matchStart))
    }

    const isSelf = mention.userId === currentUserId
    nodes.push(
      <span
        key={`m-${key++}-${matchStart}`}
        className={isSelf ? 'mention-token mention-token-self' : 'mention-token'}
      >
        {matchText}
      </span>
    )

    lastIndex = matchStart + matchText.length
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : [content]
}

export function isUserMentioned(
  mentions: ChatMention[] | null,
  currentUserId: string
): boolean {
  if (!mentions || mentions.length === 0) return false
  return mentions.some((m) => m.userId === currentUserId)
}
