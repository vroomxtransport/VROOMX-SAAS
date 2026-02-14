'use client'

import { useState } from 'react'
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

interface ChannelListProps {
  selectedChannelId: string | null
  onSelectChannel: (id: string) => void
}

export function ChannelList({ selectedChannelId, onSelectChannel }: ChannelListProps) {
  const { data: channels, isLoading } = useChannels()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [channelDesc, setChannelDesc] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!channelName.trim()) return
    setCreating(true)
    const result = await createChannel({ name: channelName.trim(), description: channelDesc.trim() })
    setCreating(false)
    if (result.data) {
      onSelectChannel(result.data.id)
      setDialogOpen(false)
      setChannelName('')
      setChannelDesc('')
    }
  }

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-border-subtle">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold">Channels</h2>
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
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : channels && channels.length > 0 ? (
          <div className="space-y-0.5 px-2">
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => onSelectChannel(channel.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left',
                  selectedChannelId === channel.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <Hash className="h-4 w-4 shrink-0 opacity-60" />
                <span className="truncate">{channel.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            No channels yet. Create one to get started.
          </p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
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
