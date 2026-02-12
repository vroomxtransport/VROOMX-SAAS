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
import { UserPlus, X, Mail, Clock } from 'lucide-react'
import { HelpTooltip } from '@/components/help-tooltip'
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
      {/* Invite form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
            <HelpTooltip
              content="Invitees receive an email link to join your organization. Dispatchers can manage orders and trips. Viewers have read-only access."
              side="right"
            />
          </CardTitle>
          <CardDescription>
            Send an email invitation to add someone to your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-3">
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              required
            />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-[140px]">
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
            <Button type="submit" disabled={sending}>
              {sending ? 'Sending...' : 'Send Invite'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Team members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members ({teamMembers.length})</CardTitle>
          <CardDescription>People who have access to your organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {teamMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                    {(member.name || member.email)[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.name || member.email}
                      {member.userId === currentUserId && (
                        <span className="ml-2 text-xs text-gray-500">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invites ({pendingInvites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {pendingInvites.map((invite) => {
                const isExpired = new Date(invite.expires_at) < new Date()
                return (
                  <div key={invite.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{invite.email}</p>
                        <p className="text-xs text-gray-500">
                          {isExpired ? 'Expired' : `Expires ${new Date(invite.expires_at).toLocaleDateString()}`}
                          {' \u00b7 '}
                          <span className="capitalize">{invite.role}</span>
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(invite.id)}
                    >
                      <X className="h-4 w-4" />
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
