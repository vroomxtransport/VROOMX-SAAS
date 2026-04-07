'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { getUserColor, getUserInitials } from './chat-utils'
import type { TenantMember } from '@/lib/queries/tenant-members'

const MAX_RESULTS = 8

interface MentionPickerProps {
  query: string
  members: TenantMember[]
  selectedIndex: number
  onSelect: (member: TenantMember) => void
  excludeUserId?: string
}

/**
 * Returns the display name for a tenant member, falling back to the email
 * local-part if no full_name is set. Mirrors the user_name fallback used by
 * sendMessage on the server.
 */
export function getMemberDisplayName(member: TenantMember): string {
  return member.fullName?.trim() || member.email.split('@')[0]
}

export function filterMembers(
  members: TenantMember[],
  query: string,
  excludeUserId?: string
): TenantMember[] {
  const q = query.toLowerCase().trim()
  return members
    .filter((m) => m.userId !== excludeUserId)
    .filter((m) => {
      if (!q) return true
      const name = getMemberDisplayName(m).toLowerCase()
      const email = m.email.toLowerCase()
      return name.includes(q) || email.includes(q)
    })
    .slice(0, MAX_RESULTS)
}

export function MentionPicker({
  query,
  members,
  selectedIndex,
  onSelect,
  excludeUserId,
}: MentionPickerProps) {
  const filtered = useMemo(
    () => filterMembers(members, query, excludeUserId),
    [members, query, excludeUserId]
  )

  const listRef = useRef<HTMLDivElement>(null)

  // Keep the highlighted row in view as the user arrows through results
  useEffect(() => {
    const container = listRef.current
    if (!container) return
    const item = container.children[selectedIndex] as HTMLElement | undefined
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-2 z-20 glass-panel rounded-xl border border-border-subtle shadow-lg overflow-hidden"
      role="listbox"
      aria-label="Mention members"
    >
      {filtered.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted-foreground text-center">
          No members match
          {query ? ` "${query}"` : ''}
        </div>
      ) : (
        <div ref={listRef} className="max-h-[280px] overflow-y-auto py-1">
          {filtered.map((member, idx) => {
            const displayName = getMemberDisplayName(member)
            const isSelected = idx === selectedIndex
            return (
              <button
                key={member.userId}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  // Prevent textarea blur, which would close the picker before onClick fires
                  e.preventDefault()
                }}
                onClick={() => onSelect(member)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                  isSelected
                    ? 'bg-brand/10 text-foreground'
                    : 'hover:bg-accent/40 text-foreground'
                )}
              >
                <Avatar size="sm">
                  <AvatarFallback
                    className={cn(
                      getUserColor(member.userId),
                      'text-white text-[10px] font-medium'
                    )}
                  >
                    {getUserInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  {member.email && member.email !== displayName && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {member.email}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
