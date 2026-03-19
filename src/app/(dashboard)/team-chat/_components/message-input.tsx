'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { sendMessage } from '@/app/actions/chat'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types/database'

const MAX_LENGTH = 5000
const WARN_THRESHOLD = 4500

interface MessageInputProps {
  channelId: string
  channelName?: string
}

export function MessageInput({ channelId, channelName }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const queryClient = useQueryClient()

  async function handleSend() {
    const trimmed = content.trim()
    if (!trimmed || sending) return

    setSending(true)
    setContent('')
    const result = await sendMessage(channelId, { content: trimmed })

    if (result && 'data' in result && result.data) {
      queryClient.setQueryData<ChatMessage[]>(
        ['chat-messages', channelId],
        (old) => old ? [...old, result.data as ChatMessage] : [result.data as ChatMessage]
      )
    }
    setSending(false)
  }

  const placeholder = channelName
    ? `Message #${channelName}...`
    : 'Type a message...'

  return (
    <div
      className="shrink-0 px-3 pb-3 pt-1 pb-safe"
      role="form"
      aria-label="Message composer"
    >
      <div className="glass-panel rounded-xl p-3">
        <div className="relative flex items-end gap-2">
          <Textarea
            placeholder={placeholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            disabled={sending}
            enterKeyHint="send"
            maxLength={MAX_LENGTH}
            rows={1}
            className="min-h-[2.5rem] max-h-[7.5rem] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 px-2 py-1.5 text-sm"
            aria-label="Message text"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={sending || !content.trim()}
            aria-label={sending ? 'Sending message' : 'Send message'}
            className="shrink-0 h-9 w-9 rounded-full bg-brand text-white hover:bg-brand/90 active:scale-95 transition-all disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {content.length >= WARN_THRESHOLD && (
          <div className="flex justify-end mt-1 pr-11">
            <span
              className={cn(
                'text-xs tabular-nums',
                content.length >= MAX_LENGTH
                  ? 'text-destructive font-medium'
                  : 'text-muted-foreground'
              )}
              aria-live="polite"
            >
              {content.length}/{MAX_LENGTH}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
