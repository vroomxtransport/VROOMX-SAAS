'use client'

import { useState, useRef, useCallback } from 'react'
import { useChannels } from '@/hooks/use-chat'
import { createChannel } from '@/app/actions/chat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Hash, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChannelListSkeleton } from './channel-skeleton'

interface ChannelListProps {
  selectedChannelId: string | null
  onSelectChannel: (id: string) => void
  onMobileClose?: () => void
}

export function ChannelList({ selectedChannelId, onSelectChannel, onMobileClose }: ChannelListProps) {
  const { data: channels, isLoading } = useChannels()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [channelDesc, setChannelDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  async function handleCreate() {
    if (!channelName.trim()) return
    setCreating(true)
    const result = await createChannel({ name: channelName.trim(), description: channelDesc.trim() })
    setCreating(false)
    if (result.data) {
      onSelectChannel(result.data.id)
      onMobileClose?.()
      setDialogOpen(false)
      setChannelName('')
      setChannelDesc('')
    }
  }

  const handleSelectChannel = useCallback((id: string) => {
    onSelectChannel(id)
    onMobileClose?.()
  }, [onSelectChannel, onMobileClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!channels || channels.length === 0) return
      const items = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
      if (!items) return

      const currentIndex = Array.from(items).findIndex(
        (item) => item === document.activeElement
      )

      let nextIndex = currentIndex
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
      } else if (e.key === 'Home') {
        e.preventDefault()
        nextIndex = 0
      } else if (e.key === 'End') {
        e.preventDefault()
        nextIndex = items.length - 1
      } else {
        return
      }

      items[nextIndex]?.focus()
    },
    [channels]
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-brand" />
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Channels
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setDialogOpen(true)}
          aria-label="Create channel"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <ChannelListSkeleton />
        ) : channels && channels.length > 0 ? (
          <div
            ref={listRef}
            className="space-y-0.5 px-2"
            role="listbox"
            aria-label="Channels"
            onKeyDown={handleKeyDown}
          >
            {channels.map((channel) => {
              const isSelected = selectedChannelId === channel.id
              return (
                <button
                  key={channel.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectChannel(channel.id)}
                  tabIndex={isSelected ? 0 : -1}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left',
                    isSelected
                      ? 'bg-brand/10 text-foreground border-l-2 border-brand'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground border-l-2 border-transparent'
                  )}
                >
                  <Hash className="h-4 w-4 shrink-0 opacity-60 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="truncate block">{channel.name}</span>
                    {channel.description && (
                      <span className="text-xs text-muted-foreground truncate block mt-0.5">
                        {channel.description}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <div className="rounded-2xl bg-accent/50 p-3">
              <Hash className="h-6 w-6 text-muted-foreground opacity-50" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No channels yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a channel to start team communication
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
              className="mt-1"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Channel
            </Button>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="shimmer-border">
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Channel name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
            />
            <Input
              placeholder="Description (optional)"
              value={channelDesc}
              onChange={(e) => setChannelDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !channelName.trim()}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
