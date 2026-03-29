'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendInvite, revokeInvite } from '@/app/actions/invites'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Clock, Mail, UserPlus, Users, X } from 'lucide-react'
import { HelpTooltip } from '@/components/help-tooltip'
import { cn } from '@/lib/utils'
import type { TenantRole } from '@/types'
import { INVITABLE_ROLES } from '@/types'

interface TeamMember {
  id: string
  userId: string
  email: string
  name: string
  role: TenantRole
  joinedAt: string
}

interface PendingInvite {
  id: string
  email: string
  role: string
  created_at: string
  expires_at: string
}

interface TeamSectionProps {
  teamMembers: TeamMember[]
  pendingInvites: PendingInvite[]
  currentUserId: string
  userRole: TenantRole
  plan: string
}

// ─── Role Styling ─────────────────────────────────────────────────────────────

type RoleStyle = { avatarBg: string; avatarText: string; badgeBg: string; badgeText: string }

const ROLE_STYLES: Record<string, RoleStyle> = {
  admin: {
    avatarBg: 'bg-rose-100',
    avatarText: 'text-rose-700',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
  },
  owner: {
    avatarBg: 'bg-rose-100',
    avatarText: 'text-rose-700',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
  },
  dispatcher: {
    avatarBg: 'bg-blue-100',
    avatarText: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
  },
  billing: {
    avatarBg: 'bg-amber-100',
    avatarText: 'text-amber-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  safety: {
    avatarBg: 'bg-emerald-100',
    avatarText: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
  },
}

const DEFAULT_ROLE_STYLE: RoleStyle = {
  avatarBg: 'bg-muted',
  avatarText: 'text-muted-foreground',
  badgeBg: 'bg-muted',
  badgeText: 'text-muted-foreground',
}

function getRoleStyle(role: string): RoleStyle {
  return ROLE_STYLES[role] ?? DEFAULT_ROLE_STYLE
}

// ─── Invite Expiry Helper ─────────────────────────────────────────────────────

function getExpiryLabel(expiresAt: string): { label: string; urgent: boolean } {
  const exp = new Date(expiresAt)
  const now = new Date()
  if (exp < now) return { label: 'Expired', urgent: true }
  const msRemaining = exp.getTime() - now.getTime()
  const daysLeft = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))
  if (daysLeft <= 1) return { label: 'Expires today', urgent: true }
  if (daysLeft <= 3) return { label: `Expires in ${daysLeft} days`, urgent: true }
  return { label: `Expires in ${daysLeft} days`, urgent: false }
}

// ─── Main Section ─────────────────────────────────────────────────────────────

export function TeamSection({
  teamMembers,
  pendingInvites,
  currentUserId,
  userRole,
  plan,
}: TeamSectionProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>('dispatcher')
  const [sending, setSending] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setSending(true)
    const result = await sendInvite({ email, role })
    setSending(false)

    if (result?.error) {
      const errorMsg = typeof result.error === 'string' ? result.error : 'Invalid input'
      toast.error(errorMsg)
      return
    }

    toast.success(`Invite sent to ${email}`)
    setEmail('')
    router.refresh()
  }

  async function handleRevoke(inviteId: string) {
    const result = await revokeInvite(inviteId)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success('Invite revoked')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-blue-100 p-2">
          <Users className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Team Members</h2>
          <p className="text-sm text-muted-foreground">Manage who has access to your organization</p>
        </div>
      </div>

      {/* Invite Form */}
      <Card className="border-blue-200/60 bg-blue-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="h-4 w-4 text-blue-600" />
            Invite Team Member
            <HelpTooltip
              content="Invitees receive an email link to join your organization. Dispatchers can manage orders and trips. Viewers have read-only access."
              side="right"
            />
          </CardTitle>
          <CardDescription className="text-xs">
            Send an email invitation to add someone to your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-3">
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
              required
            />
            <div className="flex gap-3">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={sending} className="shrink-0">
                {sending ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Team Members List */}
      <Card className="border-border-subtle">
        <CardHeader className="pb-3 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Active Members
            </CardTitle>
            <Badge variant="secondary" className="text-xs font-medium tabular-nums">
              {teamMembers.length}
            </Badge>
          </div>
          <CardDescription className="text-xs">People who currently have access to your organization.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-2">
          {teamMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Your team is just getting started</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Invite your first team member to collaborate.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle/60">
              {teamMembers.map((member) => {
                const style = getRoleStyle(member.role)
                const isYou = member.userId === currentUserId
                const initials = (member.name || member.email)[0]?.toUpperCase() ?? '?'
                const displayRole = member.role === 'owner' ? 'admin' : member.role

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between py-3 px-1 rounded-lg transition-colors hover:bg-secondary/40 -mx-1"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                          style.avatarBg,
                          style.avatarText
                        )}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground truncate">
                            {member.name || member.email}
                          </p>
                          {isYou && (
                            <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              you
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        'shrink-0 capitalize border-0 text-[11px] font-medium',
                        style.badgeBg,
                        style.badgeText
                      )}
                    >
                      {displayRole}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card className="border-amber-200/60">
          <CardHeader className="pb-3 border-b border-amber-200/60 bg-amber-500/5 rounded-t-xl">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-amber-600" />
                Pending Invites
              </CardTitle>
              <Badge className="bg-amber-100 text-amber-700 border-0 text-xs font-medium tabular-nums">
                {pendingInvites.length}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Awaiting acceptance. Invites expire after 7 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-2">
            <div className="divide-y divide-border-subtle/60">
              {pendingInvites.map((invite) => {
                const { label: expiryLabel, urgent } = getExpiryLabel(invite.expires_at)
                const inviteStyle = getRoleStyle(invite.role)

                return (
                  <div key={invite.id} className="flex items-center justify-between py-3 px-1 rounded-lg -mx-1">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                        <Mail className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{invite.email}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={cn('text-[11px]', urgent ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                            {expiryLabel}
                          </span>
                          <span className="text-muted-foreground text-[11px]">&middot;</span>
                          <Badge
                            className={cn(
                              'capitalize border-0 text-[10px] font-medium px-1.5 py-0',
                              inviteStyle.badgeBg,
                              inviteStyle.badgeText
                            )}
                          >
                            {invite.role}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(invite.id)}
                      className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Revoke invite</span>
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
