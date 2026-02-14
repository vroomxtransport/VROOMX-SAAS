'use client'

import { useState } from 'react'
import { sendMessage } from '@/app/actions/chat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send } from 'lucide-react'

interface MessageInputProps {
  channelId: string
}

export function MessageInput({ channelId }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const trimmed = content.trim()
    if (!trimmed || sending) return

    setSending(true)
    setContent('')
    await sendMessage(channelId, { content: trimmed })
    setSending(false)
  }

  return (
    <div className="border-t border-border-subtle p-4 flex gap-2">
      <Input
        placeholder="Type a message..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
        disabled={sending}
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={sending || !content.trim()}
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}
