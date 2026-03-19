'use client'

import { useState, useCallback, useMemo } from 'react'
import { useDispatchers } from '@/hooks/use-dispatchers'
import { useDispatchersWithPayConfig } from '@/hooks/use-dispatcher-payroll'
import { DispatcherCard } from './dispatcher-card'
import { DispatcherPayConfigDrawer } from './dispatcher-pay-config-drawer'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Users, UserPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { sendInvite } from '@/app/actions/invites'
import { INVITABLE_ROLES } from '@/types'
import type { EnhancedFilterConfig, DateRange } from '@/types/filters'
import type { Dispatcher } from '@/lib/queries/dispatchers'
import type { DispatcherPayConfig } from '@/types/database'

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'dispatcher', label: 'Dispatcher' },
]

const FILTER_CONFIG: EnhancedFilterConfig[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Dispatcher name...',
  },
  {
    key: 'role',
    label: 'Role',
    type: 'select',
    options: ROLE_OPTIONS,
  },
]

export function DispatcherList() {
  const { data: dispatchers, isLoading } = useDispatchers()
  const { data: dispatchersWithConfig } = useDispatchersWithPayConfig()

  const [search, setSearch] = useState<string | undefined>(undefined)
  const [role, setRole] = useState<string | undefined>(undefined)
  const [payConfigDrawerOpen, setPayConfigDrawerOpen] = useState(false)
  const [selectedDispatcher, setSelectedDispatcher] = useState<Dispatcher | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('dispatcher')
  const [inviteSending, setInviteSending] = useState(false)

  // Build pay config map from dispatcher-with-pay-config data
  const payConfigMap = useMemo(() => {
    const map = new Map<string, DispatcherPayConfig>()
    for (const d of dispatchersWithConfig ?? []) {
      if (d.pay_config) {
        map.set(d.user_id, d.pay_config)
      }
    }
    return map
  }, [dispatchersWithConfig])

  const activeFilters = useMemo(() => {
    const filters: Record<string, string | string[] | DateRange | undefined> = {}
    if (search) filters.search = search
    if (role) filters.role = role
    return filters
  }, [search, role])

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      if (key === 'search') {
        setSearch(value as string | undefined)
      } else if (key === 'role') {
        setRole(value as string | undefined)
      }
    },
    []
  )

  const filtered = useMemo(() => {
    if (!dispatchers) return []
    let result = [...dispatchers]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (d) =>
          d.full_name.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q)
      )
    }

    if (role) {
      result = result.filter((d) => d.role === role)
    }

    return result
  }, [dispatchers, search, role])

  const handleCsvExport = useCallback(async () => {
    return filtered.map((d) => ({
      full_name: d.full_name || d.user_id.substring(0, 8),
      email: d.email,
      role: d.role,
      created_at: new Date(d.created_at).toLocaleDateString('en-US'),
    }))
  }, [filtered])

  const handleConfigurePay = useCallback((dispatcher: Dispatcher) => {
    setSelectedDispatcher(dispatcher)
    setPayConfigDrawerOpen(true)
  }, [])

  const handleInvite = useCallback(async () => {
    if (!inviteEmail) return
    setInviteSending(true)
    const result = await sendInvite({ email: inviteEmail, role: inviteRole })
    setInviteSending(false)

    if (result?.error) {
      const msg = typeof result.error === 'string' ? result.error : 'Invalid input'
      toast.error(msg)
      return
    }

    toast.success(`Invite sent to ${inviteEmail}`)
    setInviteEmail('')
    setInviteRole('dispatcher')
    setInviteOpen(false)
  }, [inviteEmail, inviteRole])

  if (isLoading) {
    return (
      <div>
        <div className="mb-4">
          <Skeleton className="h-9 w-[300px]" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!dispatchers || dispatchers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No dispatchers yet"
        description="Dispatchers will appear here once team members are added with dispatcher, admin, or owner roles."
      />
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <EnhancedFilterBar
            filters={FILTER_CONFIG}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            resultCount={filtered.length}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CsvExportButton
            filename="dispatchers"
            headers={['full_name', 'email', 'role', 'created_at']}
            fetchData={handleCsvExport}
          />
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Invite Dispatcher
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No matching dispatchers"
          description="Try adjusting your search or filters."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((dispatcher) => (
            <DispatcherCard
              key={dispatcher.id}
              dispatcher={dispatcher}
              payConfig={payConfigMap.get(dispatcher.user_id)}
              onConfigurePay={() => handleConfigurePay(dispatcher)}
            />
          ))}
        </div>
      )}

      {selectedDispatcher && (
        <DispatcherPayConfigDrawer
          open={payConfigDrawerOpen}
          onOpenChange={setPayConfigDrawerOpen}
          dispatcher={selectedDispatcher}
          existingConfig={payConfigMap.get(selectedDispatcher.user_id)}
        />
      )}

      {/* Invite Dispatcher Drawer */}
      <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Invite Dispatcher</SheetTitle>
            <SheetDescription>
              Send an email invitation to add a new team member.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4 px-4 pb-4">
            <div>
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div>
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setInviteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleInvite}
                disabled={inviteSending || !inviteEmail}
              >
                {inviteSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invite
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
