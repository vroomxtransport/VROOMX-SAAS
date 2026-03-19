'use client'

import { forwardRef } from 'react'
import { Hash, Menu, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { getUserColor, getUserInitials } from './chat-utils'
import type { ChatChannel } from '@/types/database'
import type { PresenceMember } from '@/hooks/use-chat-presence'

interface ChannelHeaderProps {
  channel: ChatChannel | undefined
  onMobileMenuOpen?: () => void
  members?: PresenceMember[]
  onlineCount?: number
  onToggleMemberList?: () => void
}

export const ChannelHeader = forwardRef<HTMLHeadingElement, ChannelHeaderProps>(
  function ChannelHeader({ channel, onMobileMenuOpen, members, onlineCount, onToggleMemberList }, ref) {
    if (!channel) return null

    const displayMembers = members?.slice(0, 3) ?? []
    const extraCount = (onlineCount ?? 0) - displayMembers.length

    return (
      <div className="glass-panel flex items-center gap-3 border-b border-border-subtle px-4 py-3 shrink-0">
        {onMobileMenuOpen && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onMobileMenuOpen}
            aria-label="Open channels"
            className="md:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}

        <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />

        <div className="flex-1 min-w-0">
          <h2
            ref={ref}
            tabIndex={-1}
            className="text-sm font-semibold text-foreground truncate outline-none"
          >
            {channel.name}
          </h2>
          {channel.description && (
            <p className="text-xs text-muted-foreground truncate">
              {channel.description}
            </p>
          )}
        </div>

        {/* Member presence indicator */}
        <button
          onClick={onToggleMemberList}
          className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent/50 transition-colors cursor-pointer"
          aria-label={`${onlineCount ?? 0} members online. Click to toggle member list.`}
        >
          {displayMembers.length > 0 ? (
            <AvatarGroup>
              {displayMembers.map((m) => (
                <Avatar key={m.userId} size="sm">
                  <AvatarFallback
                    className={cn(getUserColor(m.userId), 'text-white text-[10px] font-medium')}
                  >
                    {getUserInitials(m.userName || m.email)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {extraCount > 0 && (
                <AvatarGroupCount>
                  <span className="text-[10px]">+{extraCount}</span>
                </AvatarGroupCount>
              )}
            </AvatarGroup>
          ) : (
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          )}

          {(onlineCount ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">{onlineCount}</span>
            </div>
          )}
        </button>
      </div>
    )
  }
)
