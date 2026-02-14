'use client'

import { useState } from 'react'
import { ChannelList } from './channel-list'
import { MessageFeed } from './message-feed'
import { MessageInput } from './message-input'
import { MessageSquare } from 'lucide-react'

export function ChatLayout() {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 lg:-mx-8 lg:-my-6 rounded-lg overflow-hidden border border-border-subtle bg-surface">
      <ChannelList
        selectedChannelId={selectedChannelId}
        onSelectChannel={setSelectedChannelId}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {selectedChannelId ? (
          <>
            <MessageFeed channelId={selectedChannelId} />
            <MessageInput channelId={selectedChannelId} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="h-12 w-12 opacity-30" />
            <p className="text-sm">Select a channel to start chatting</p>
          </div>
        )}
      </div>
    </div>
  )
}
