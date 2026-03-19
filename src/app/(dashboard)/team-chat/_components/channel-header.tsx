'use client'

import { forwardRef } from 'react'
import { Hash, Menu, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChatChannel } from '@/types/database'

interface ChannelHeaderProps {
  channel: ChatChannel | undefined
  onMobileMenuOpen?: () => void
}

export const ChannelHeader = forwardRef<HTMLHeadingElement, ChannelHeaderProps>(
  function ChannelHeader({ channel, onMobileMenuOpen }, ref) {
    if (!channel) return null

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

        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>Team</span>
        </div>
      </div>
    )
  }
)
