'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useMessages } from '@/hooks/use-chat'
import { MessageBubble } from './message-bubble'
import { DateSeparator } from './date-separator'
import { MessageFeedSkeleton } from './message-skeleton'
import { shouldGroupMessage, getDateKey } from './chat-utils'
import { ChevronDown, MessageSquare } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface MessageFeedProps {
  channelId: string
  currentUserId: string
}

export function MessageFeed({ channelId, currentUserId }: MessageFeedProps) {
  const { data: messages, isLoading } = useMessages(channelId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevMessageCountRef = useRef(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)

  // Track whether user is at bottom via IntersectionObserver
  useEffect(() => {
    const el = bottomRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting)
        if (entry.isIntersecting) setHasNewMessages(false)
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    if (!messages) return

    const isNewMessage = messages.length > prevMessageCountRef.current
    prevMessageCountRef.current = messages.length

    if (initialLoad) {
      // Instant scroll on first load
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
      setInitialLoad(false)
      return
    }

    if (isNewMessage) {
      if (isAtBottom) {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        bottomRef.current?.scrollIntoView({ behavior: prefersReduced ? 'instant' : 'smooth' })
      } else {
        setHasNewMessages(true)
      }
    }
  }, [messages, isAtBottom, initialLoad])

  // Reset on channel switch
  useEffect(() => {
    setInitialLoad(true)
    prevMessageCountRef.current = 0
    setHasNewMessages(false)
  }, [channelId])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setHasNewMessages(false)
  }, [])

  if (isLoading) {
    return (
      <div className="flex-1 overflow-hidden">
        <MessageFeedSkeleton />
      </div>
    )
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground px-6">
        <div className="rounded-2xl bg-accent/50 p-4">
          <MessageSquare className="h-10 w-10 opacity-50" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">No messages yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Be the first to start the conversation in this channel
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div
          className="px-4 py-2"
          role="log"
          aria-label="Message history"
          aria-relevant="additions"
        >
          {messages.map((message, index) => {
            const prev = index > 0 ? messages[index - 1] : undefined
            const isGrouped = shouldGroupMessage(message, prev)
            const currentDateKey = getDateKey(message.created_at)
            const prevDateKey = prev ? getDateKey(prev.created_at) : null
            const showDateSeparator = currentDateKey !== prevDateKey
            const isRecent = index >= messages.length - 3 && !initialLoad

            return (
              <div key={message.id}>
                {showDateSeparator && (
                  <DateSeparator date={message.created_at} />
                )}
                <MessageBubble
                  message={message}
                  isGrouped={isGrouped && !showDateSeparator}
                  animate={isRecent}
                  currentUserId={currentUserId}
                />
              </div>
            )
          })}
          <div ref={bottomRef} className="h-1" />
        </div>
      </ScrollArea>

      {/* Screen reader live region for new messages */}
      <div aria-live="polite" aria-atomic="false" className="sr-only">
        {messages.length > 0 && (() => {
          const last = messages[messages.length - 1]
          const parts = [last.user_name ?? 'Unknown']
          if (last.content) parts.push(`says: ${last.content}`)
          if (last.attachments?.length) parts.push(`sent ${last.attachments.length} file${last.attachments.length > 1 ? 's' : ''}`)
          return <span>{parts.join(' ')}</span>
        })()}
      </div>

      {/* Scroll-to-bottom button */}
      {hasNewMessages && !isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-lg transition-all hover:bg-brand/90 active:scale-95 animate-message-in"
          aria-label="Scroll to newest messages"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          New messages
        </button>
      )}
    </div>
  )
}
