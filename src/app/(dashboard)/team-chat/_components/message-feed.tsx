'use client'

import { useEffect, useRef } from 'react'
import { useMessages } from '@/hooks/use-chat'
import { MessageBubble } from './message-bubble'
import { Loader2, MessageSquare } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface MessageFeedProps {
  channelId: string
}

export function MessageFeed({ channelId }: MessageFeedProps) {
  const { data: messages, isLoading } = useMessages(channelId)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <MessageSquare className="h-10 w-10 opacity-30" />
        <p className="text-sm">No messages yet. Start the conversation!</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-3 p-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
