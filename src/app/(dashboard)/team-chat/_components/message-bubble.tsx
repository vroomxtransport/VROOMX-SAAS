'use client'

import type { ChatMessage } from '@/types/database'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-foreground">
          {message.user_name ?? 'Unknown'}
        </span>
        <span className="text-xs text-muted-foreground">{time}</span>
      </div>
      <p className="text-sm text-foreground/90">{message.content}</p>
    </div>
  )
}
