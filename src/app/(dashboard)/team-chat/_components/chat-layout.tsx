'use client'

import { useState, useEffect, useRef, useMemo, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useChannels } from '@/hooks/use-chat'
import { useChatPresence } from '@/hooks/use-chat-presence'
import { markChannelRead } from '@/app/actions/chat-reads'
import { ChannelList } from './channel-list'
import { ChannelHeader } from './channel-header'
import { MessageFeed } from './message-feed'
import { MessageInput } from './message-input'
import { MemberList } from './member-list'
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
  userId: string
  userName: string
  email: string
}

const MD_BREAKPOINT = '(max-width: 767px)'
const subscribe = (cb: () => void) => {
  const mql = window.matchMedia(MD_BREAKPOINT)
  mql.addEventListener('change', cb)
  return () => mql.removeEventListener('change', cb)
}
const getSnapshot = () => window.matchMedia(MD_BREAKPOINT).matches
const getServerSnapshot = () => false

export function ChatLayout({ tenantId, userId, userName, email }: ChatLayoutProps) {
  const isMobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [memberListOpen, setMemberListOpen] = useState(false)
  const { data: channels } = useChannels()
  const headerRef = useRef<HTMLHeadingElement>(null)
  const queryClient = useQueryClient()

  const { members, onlineCount, setStatus } = useChatPresence(tenantId, {
    userId,
    userName,
    email,
  })

  const selectedChannel = useMemo(
    () => channels?.find((c) => c.id === selectedChannelId),
    [channels, selectedChannelId]
  )

  // Focus channel heading on channel switch
  useEffect(() => {
    if (selectedChannelId) {
      requestAnimationFrame(() => headerRef.current?.focus())
    }
  }, [selectedChannelId])

  // Mark channel as read when user opens or switches to it
  useEffect(() => {
    if (!selectedChannelId) return
    markChannelRead(selectedChannelId).then(() => {
      queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
    })
  }, [selectedChannelId, queryClient])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-[calc(100vh-3.5rem)] -m-4 lg:-mx-8 lg:-my-6 rounded-xl overflow-hidden border border-border-subtle glass-panel shadow-sm">
        {/* Desktop channel sidebar */}
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

        {/* Mobile channel Sheet */}
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
                members={members}
                onlineCount={onlineCount}
                onToggleMemberList={() => setMemberListOpen(!memberListOpen)}
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

        {/* Member list sidebar (desktop) */}
        {selectedChannelId && memberListOpen && (
          <div className="hidden md:flex w-64 shrink-0 flex-col border-l border-border-subtle glass-panel">
            <MemberList
              members={members}
              currentUserId={userId}
              onSetStatus={setStatus}
              onClose={() => setMemberListOpen(false)}
            />
          </div>
        )}

        {/* Member list Sheet (mobile only — desktop uses inline sidebar above) */}
        <Sheet open={memberListOpen && isMobile} onOpenChange={setMemberListOpen}>
          <SheetContent
            side="right"
            className="w-[280px] p-0 md:hidden"
            showCloseButton={false}
          >
            <MemberList
              members={members}
              currentUserId={userId}
              onSetStatus={setStatus}
              onClose={() => setMemberListOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  )
}
