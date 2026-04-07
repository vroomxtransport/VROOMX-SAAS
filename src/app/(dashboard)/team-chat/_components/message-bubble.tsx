'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getUserColor, getUserInitials, getUserTextColor } from './chat-utils'
import { renderMessageContent, isUserMentioned } from './mention-render'
import { AttachmentDisplay } from './attachment-display'
import type { ChatMessage } from '@/types/database'

interface MessageBubbleProps {
  message: ChatMessage
  isGrouped: boolean
  animate?: boolean
  currentUserId: string
}

export function MessageBubble({ message, isGrouped, animate, currentUserId }: MessageBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  const avatarBg = getUserColor(message.user_id)
  const nameColor = getUserTextColor(message.user_id)
  const initials = getUserInitials(message.user_name)
  const hasText = message.content && message.content.trim().length > 0
  const hasAttachments = message.attachments && message.attachments.length > 0
  const attachmentCount = message.attachments?.length ?? 0
  const mentionsCurrentUser = isUserMentioned(message.mentions, currentUserId)

  const ariaLabel = [
    `${message.user_name ?? 'Unknown'} at ${time}:`,
    hasText ? message.content : null,
    hasAttachments ? `${attachmentCount} attachment${attachmentCount > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-accent/30',
        isGrouped ? 'mt-0.5' : 'mt-3 first:mt-0',
        animate && 'animate-message-in'
      )}
      role="article"
      aria-label={ariaLabel}
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
        <div className="max-w-[85%] w-fit">
          {hasText && (
            <div
              className={cn(
                'rounded-lg shadow-sm px-3 py-2 border',
                mentionsCurrentUser
                  ? 'bg-brand/5 border-brand/30 ring-1 ring-brand/20'
                  : 'bg-surface-raised border-border-subtle'
              )}
            >
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                {renderMessageContent(message.content!, message.mentions, currentUserId)}
              </p>
            </div>
          )}
          {hasAttachments && (
            <AttachmentDisplay attachments={message.attachments!} />
          )}
        </div>
      </div>
    </div>
  )
}
