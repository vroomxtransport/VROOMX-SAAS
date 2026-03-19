'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getUserColor, getUserInitials, getUserTextColor } from './chat-utils'
import type { ChatMessage } from '@/types/database'

interface MessageBubbleProps {
  message: ChatMessage
  isGrouped: boolean
  animate?: boolean
}

export function MessageBubble({ message, isGrouped, animate }: MessageBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  const avatarBg = getUserColor(message.user_id)
  const nameColor = getUserTextColor(message.user_id)
  const initials = getUserInitials(message.user_name)

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-accent/30',
        isGrouped ? 'mt-0.5' : 'mt-3 first:mt-0',
        animate && 'animate-message-in'
      )}
      role="article"
      aria-label={`${message.user_name ?? 'Unknown'} at ${time}: ${message.content}`}
    >
      {isGrouped ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-8 shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] text-muted-foreground">{time}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            {time}
          </TooltipContent>
        </Tooltip>
      ) : (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className={cn(avatarBg, 'text-white text-xs font-medium')}>
            {initials}
          </AvatarFallback>
        </Avatar>
      )}

      <div className="min-w-0 flex-1">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className={cn('text-sm font-semibold', nameColor)}>
              {message.user_name ?? 'Unknown'}
            </span>
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>
        )}
        <div className="rounded-lg bg-surface-raised px-3 py-2 max-w-[85%] w-fit">
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </div>
    </div>
  )
}
