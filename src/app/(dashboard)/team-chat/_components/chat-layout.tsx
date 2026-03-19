'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useChannels } from '@/hooks/use-chat'
import { ChannelList } from './channel-list'
import { ChannelHeader } from './channel-header'
import { MessageFeed } from './message-feed'
import { MessageInput } from './message-input'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'

interface ChatLayoutProps {
  tenantId: string
}

export function ChatLayout({ tenantId }: ChatLayoutProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { data: channels } = useChannels()
  const headerRef = useRef<HTMLHeadingElement>(null)

  const selectedChannel = useMemo(
    () => channels?.find((c) => c.id === selectedChannelId),
    [channels, selectedChannelId]
  )

  // Focus channel heading on channel switch
  useEffect(() => {
    if (selectedChannelId) {
      // Small delay to let the DOM update
      requestAnimationFrame(() => headerRef.current?.focus())
    }
  }, [selectedChannelId])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-[calc(100vh-3.5rem)] -m-4 lg:-mx-8 lg:-my-6 rounded-xl overflow-hidden border border-border-subtle glass-panel shadow-sm">
        {/* Desktop sidebar */}
        <div
          className="hidden md:flex w-72 shrink-0 flex-col border-r border-border-subtle glass-panel"
          role="complementary"
          aria-label="Channel list"
        >
          <ChannelList
            selectedChannelId={selectedChannelId}
            onSelectChannel={setSelectedChannelId}
          />
        </div>

        {/* Mobile Sheet */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent
            side="left"
            className="w-[280px] p-0 md:hidden"
            showCloseButton={false}
          >
            <SheetHeader className="border-b border-border-subtle px-4 py-3">
              <SheetTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Channels
              </SheetTitle>
            </SheetHeader>
            <ChannelList
              selectedChannelId={selectedChannelId}
              onSelectChannel={setSelectedChannelId}
              onMobileClose={() => setMobileMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Main message area */}
        <div className="flex flex-1 flex-col min-w-0">
          {selectedChannelId ? (
            <>
              <ChannelHeader
                ref={headerRef}
                channel={selectedChannel}
                onMobileMenuOpen={() => setMobileMenuOpen(true)}
              />
              <MessageFeed channelId={selectedChannelId} />
              <MessageInput
                channelId={selectedChannelId}
                channelName={selectedChannel?.name}
                tenantId={tenantId}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground px-6">
              <div className="rounded-2xl bg-accent/50 p-5">
                <MessageSquare className="h-12 w-12 opacity-40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Select a channel to start chatting
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pick a channel from the sidebar to message your team
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden mt-2"
              >
                Browse Channels
              </Button>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
