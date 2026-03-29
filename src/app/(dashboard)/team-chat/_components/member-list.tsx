'use client'

import { Avatar, AvatarFallback, AvatarBadge } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { X, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUserColor, getUserInitials } from './chat-utils'
import type { PresenceMember, PresenceStatus } from '@/hooks/use-chat-presence'

interface MemberListProps {
  members: PresenceMember[]
  currentUserId: string
  onSetStatus: (status: PresenceStatus) => void
  onClose: () => void
}

const STATUS_CONFIG = {
  online: { color: 'bg-emerald-500', label: 'Online' },
  busy: { color: 'bg-amber-500', label: 'Busy' },
} as const

export function MemberList({ members, currentUserId, onSetStatus, onClose }: MemberListProps) {
  const onlineMembers = members.filter((m) => m.status === 'online')
  const busyMembers = members.filter((m) => m.status === 'busy')
  const currentMember = members.find((m) => m.userId === currentUserId)
  const currentStatus = currentMember?.status ?? 'online'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Members
          </h3>
          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
            {members.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label="Close member list"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Status toggle for current user */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Your status
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={() => onSetStatus('online')}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              currentStatus === 'online'
                ? 'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/30'
                : 'text-muted-foreground hover:bg-accent/50'
            )}
          >
            <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
            Online
          </button>
          <button
            onClick={() => onSetStatus('busy')}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              currentStatus === 'busy'
                ? 'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/30'
                : 'text-muted-foreground hover:bg-accent/50'
            )}
          >
            <Circle className="h-2 w-2 fill-amber-500 text-amber-500" />
            Busy
          </button>
        </div>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Online section */}
        {onlineMembers.length > 0 && (
          <div className="px-4 py-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Online — {onlineMembers.length}
            </p>
            <div className="space-y-0.5">
              {onlineMembers.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  isCurrentUser={member.userId === currentUserId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Busy section */}
        {busyMembers.length > 0 && (
          <div className="px-4 py-1 mt-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Busy — {busyMembers.length}
            </p>
            <div className="space-y-0.5">
              {busyMembers.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  isCurrentUser={member.userId === currentUserId}
                />
              ))}
            </div>
          </div>
        )}

        {members.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            No members online
          </p>
        )}
      </div>
    </div>
  )
}

function MemberRow({ member, isCurrentUser }: { member: PresenceMember; isCurrentUser: boolean }) {
  const avatarBg = getUserColor(member.userId)
  const initials = getUserInitials(member.userName || member.email)
  const config = STATUS_CONFIG[member.status]

  return (
    <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/30 transition-colors">
      <Avatar size="sm">
        <AvatarFallback className={cn(avatarBg, 'text-white text-[10px] font-medium')}>
          {initials}
        </AvatarFallback>
        <AvatarBadge className={cn(config.color, 'ring-background')} />
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">
          {member.userName || member.email.split('@')[0]}
          {isCurrentUser && (
            <span className="text-muted-foreground font-normal ml-1">(you)</span>
          )}
        </p>
      </div>
    </div>
  )
}
