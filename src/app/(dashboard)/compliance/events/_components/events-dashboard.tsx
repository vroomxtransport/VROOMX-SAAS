'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { StatCard } from '@/components/shared/stat-card'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EventCard } from './event-card'
import { EventDrawer } from './event-drawer'
import { ResolveDialog } from './resolve-dialog'
import { deleteSafetyEvent } from '@/app/actions/safety-events'
import {
  SAFETY_EVENT_TYPE_LABELS,
  SAFETY_EVENT_SEVERITY_LABELS,
  SAFETY_EVENT_STATUS_LABELS,
  SAFETY_EVENT_TYPES,
  SAFETY_EVENT_SEVERITIES,
  SAFETY_EVENT_STATUSES,
} from '@/types'
import type { SafetyEventType, SafetyEventSeverity, SafetyEventStatus } from '@/types'
import type { SafetyEvent } from '@/types/database'
import { ShieldAlert, AlertTriangle, FileWarning, ClipboardList, Plus, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

type TabValue = 'all' | SafetyEventType

const TABS: { value: TabValue; label: string }[] = [
  { value: 'all', label: 'All Events' },
  { value: 'incident', label: 'Incidents' },
  { value: 'claim', label: 'Claims' },
  { value: 'dot_inspection', label: 'DOT Inspections' },
]

interface EventFilters {
  tab: TabValue
  dateFrom: string
  dateTo: string
  driverId: string
  truckId: string
  severity: string
  status: string
  page: number
}

const DEFAULT_FILTERS: EventFilters = {
  tab: 'all',
  dateFrom: '',
  dateTo: '',
  driverId: '',
  truckId: '',
  severity: '',
  status: '',
  page: 0,
}

async function fetchSafetyEvents(filters: EventFilters) {
  const supabase = createClient()

  let query = supabase
    .from('safety_events')
    .select(
      '*, driver:drivers(id, first_name, last_name), truck:trucks(id, unit_number, make, model)',
      { count: 'exact' }
    )
    .order('event_date', { ascending: false })

  if (filters.tab !== 'all') {
    query = query.eq('event_type', filters.tab)
  }
  if (filters.severity) {
    query = query.eq('severity', filters.severity)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.driverId) {
    query = query.eq('driver_id', filters.driverId)
  }
  if (filters.truckId) {
    query = query.eq('truck_id', filters.truckId)
  }
  if (filters.dateFrom) {
    query = query.gte('event_date', filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte('event_date', filters.dateTo)
  }

  const { data, count, error } = await query.range(
    filters.page * PAGE_SIZE,
    (filters.page + 1) * PAGE_SIZE - 1
  )

  if (error) throw error
  return { events: (data ?? []) as SafetyEvent[], total: count ?? 0 }
}

async function fetchKpiData() {
  const supabase = createClient()
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [openResult, claimsResult, dotResult] = await Promise.all([
    // Open events with financial amounts
    supabase
      .from('safety_events')
      .select('financial_amount, status')
      .in('status', ['open', 'under_review']),
    // Claims this month
    supabase
      .from('safety_events')
      .select('id', { count: 'exact' })
      .eq('event_type', 'claim')
      .gte('event_date', firstOfMonth),
    // DOT inspections this month
    supabase
      .from('safety_events')
      .select('id', { count: 'exact' })
      .eq('event_type', 'dot_inspection')
      .gte('event_date', firstOfMonth),
  ])

  const openEvents = openResult.data ?? []
  const openCount = openEvents.length
  const totalFinancialImpact = openEvents.reduce((sum, e) => {
    const amt = e.financial_amount ? parseFloat(e.financial_amount) : 0
    return sum + (isNaN(amt) ? 0 : amt)
  }, 0)

  return {
    openCount,
    totalFinancialImpact,
    claimsThisMonth: claimsResult.count ?? 0,
    dotThisMonth: dotResult.count ?? 0,
  }
}

async function fetchDriversAndTrucks() {
  const supabase = createClient()
  const [driversResult, trucksResult] = await Promise.all([
    supabase
      .from('drivers')
      .select('id, first_name, last_name')
      .eq('driver_status', 'active')
      .order('first_name'),
    supabase
      .from('trucks')
      .select('id, unit_number, make')
      .eq('truck_status', 'active')
      .order('unit_number'),
  ])
  return {
    drivers: driversResult.data ?? [],
    trucks: trucksResult.data ?? [],
  }
}

function KpiRow({ openCount, totalFinancialImpact, claimsThisMonth, dotThisMonth }: {
  openCount: number
  totalFinancialImpact: number
  claimsThisMonth: number
  dotThisMonth: number
}) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(totalFinancialImpact)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        label="Open Events"
        value={openCount}
        sublabel="Require attention"
        icon={ShieldAlert}
        accent="amber"
      />
      <StatCard
        label="Financial Exposure"
        value={formatted}
        sublabel="Open & under review"
        icon={FileWarning}
        accent="violet"
      />
      <StatCard
        label="Claims This Month"
        value={claimsThisMonth}
        sublabel="Cargo damage claims"
        icon={AlertTriangle}
        accent="amber"
      />
      <StatCard
        label="DOT Inspections"
        value={dotThisMonth}
        sublabel="This month"
        icon={ClipboardList}
        accent="blue"
      />
    </div>
  )
}

function TabBar({
  activeTab,
  tabCounts,
  onChange,
}: {
  activeTab: TabValue
  tabCounts: Record<TabValue, number>
  onChange: (tab: TabValue) => void
}) {
  return (
    <div className="widget-card flex items-center gap-1 p-1.5 w-fit overflow-x-auto">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200',
            activeTab === tab.value
              ? 'bg-surface shadow-sm text-foreground border-b-2 border-brand'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
          {tabCounts[tab.value] > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 min-w-[1rem] px-1 leading-none"
            >
              {tabCounts[tab.value]}
            </Badge>
          )}
        </button>
      ))}
    </div>
  )
}

function EventCardSkeleton() {
  return (
    <div className="rounded-xl border border-border-subtle border-l-4 border-l-border-subtle bg-surface p-3 shadow-sm space-y-2">
      <div className="flex items-start gap-2.5">
        <Skeleton className="h-4 w-4 rounded shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
        <div className="flex flex-col gap-1 items-end">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
    </div>
  )
}

export function EventsDashboard() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<SafetyEvent | undefined>()
  const [defaultDrawerType, setDefaultDrawerType] = useState<SafetyEventType | undefined>()
  const [resolveEvent, setResolveEvent] = useState<SafetyEvent | undefined>()

  const { data: kpi, isLoading: kpiLoading } = useQuery({
    queryKey: ['safety-events-kpi'],
    queryFn: fetchKpiData,
    staleTime: 30_000,
  })

  const { data: lookups } = useQuery({
    queryKey: ['safety-events-lookups'],
    queryFn: fetchDriversAndTrucks,
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['safety-events', filters],
    queryFn: () => fetchSafetyEvents(filters),
    staleTime: 30_000,
  })

  // Per-tab count queries (lightweight)
  const { data: tabCounts } = useQuery({
    queryKey: ['safety-events-tab-counts'],
    queryFn: async () => {
      const supabase = createClient()
      const [allResult, incidentResult, claimResult, dotResult] = await Promise.all([
        supabase.from('safety_events').select('id', { count: 'exact', head: true }),
        supabase.from('safety_events').select('id', { count: 'exact', head: true }).eq('event_type', 'incident'),
        supabase.from('safety_events').select('id', { count: 'exact', head: true }).eq('event_type', 'claim'),
        supabase.from('safety_events').select('id', { count: 'exact', head: true }).eq('event_type', 'dot_inspection'),
      ])
      return {
        all: allResult.count ?? 0,
        incident: incidentResult.count ?? 0,
        claim: claimResult.count ?? 0,
        dot_inspection: dotResult.count ?? 0,
      }
    },
    staleTime: 30_000,
  })

  const setFilter = useCallback(<K extends keyof EventFilters>(key: K, value: EventFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 0 }))
  }, [])

  const handleTabChange = useCallback((tab: TabValue) => {
    setFilters(prev => ({ ...prev, tab, page: 0 }))
  }, [])

  const handleNewEvent = useCallback((type?: SafetyEventType) => {
    setEditingEvent(undefined)
    setDefaultDrawerType(type)
    setDrawerOpen(true)
  }, [])

  const handleEdit = useCallback((event: SafetyEvent) => {
    setEditingEvent(event)
    setDefaultDrawerType(undefined)
    setDrawerOpen(true)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await deleteSafetyEvent(id)
    queryClient.invalidateQueries({ queryKey: ['safety-events'] })
    queryClient.invalidateQueries({ queryKey: ['safety-events-kpi'] })
    queryClient.invalidateQueries({ queryKey: ['safety-events-tab-counts'] })
  }, [queryClient])

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false)
    setEditingEvent(undefined)
    setDefaultDrawerType(undefined)
  }, [])

  const handleResolveClose = useCallback(() => {
    setResolveEvent(undefined)
    queryClient.invalidateQueries({ queryKey: ['safety-events'] })
    queryClient.invalidateQueries({ queryKey: ['safety-events-kpi'] })
    queryClient.invalidateQueries({ queryKey: ['safety-events-tab-counts'] })
  }, [queryClient])

  const events = data?.events ?? []
  const total = data?.total ?? 0

  const counts: Record<TabValue, number> = {
    all: tabCounts?.all ?? 0,
    incident: tabCounts?.incident ?? 0,
    claim: tabCounts?.claim ?? 0,
    dot_inspection: tabCounts?.dot_inspection ?? 0,
  }

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      {kpiLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <KpiRow
          openCount={kpi?.openCount ?? 0}
          totalFinancialImpact={kpi?.totalFinancialImpact ?? 0}
          claimsThisMonth={kpi?.claimsThisMonth ?? 0}
          dotThisMonth={kpi?.dotThisMonth ?? 0}
        />
      )}

      {/* Tab bar + action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabBar
          activeTab={filters.tab}
          tabCounts={counts}
          onChange={handleTabChange}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              // Export: trigger CSV download of current visible events
              const rows = events.map(e => [
                e.event_date,
                e.event_type,
                e.severity,
                e.status,
                e.title,
                e.driver ? `${e.driver.first_name} ${e.driver.last_name}` : '',
                e.truck ? `#${e.truck.unit_number}` : '',
                e.financial_amount ? parseFloat(e.financial_amount).toFixed(2) : '',
                e.location ?? '',
                e.location_state ?? '',
              ].join(','))
              const header = 'Date,Type,Severity,Status,Title,Driver,Truck,Financial Amount,Location,State'
              const csv = [header, ...rows].join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `safety-events-${new Date().toISOString().split('T')[0]}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => handleNewEvent(
              filters.tab !== 'all' ? filters.tab as SafetyEventType : undefined
            )}
          >
            <Plus className="h-4 w-4" />
            New Event
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-border-subtle bg-surface p-3">
        <div className="flex flex-wrap gap-3">
          {/* Date range */}
          <div className="flex items-center gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilter('dateFrom', e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilter('dateTo', e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
          </div>

          {/* Driver filter */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Driver</Label>
            <Select
              value={filters.driverId || '_all'}
              onValueChange={(v) => setFilter('driverId', v === '_all' ? '' : v)}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="All drivers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All drivers</SelectItem>
                {(lookups?.drivers ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.first_name} {d.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Truck filter */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Truck</Label>
            <Select
              value={filters.truckId || '_all'}
              onValueChange={(v) => setFilter('truckId', v === '_all' ? '' : v)}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All trucks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All trucks</SelectItem>
                {(lookups?.trucks ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    #{t.unit_number}{t.make ? ` — ${t.make}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity filter */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Severity</Label>
            <Select
              value={filters.severity || '_all'}
              onValueChange={(v) => setFilter('severity', v === '_all' ? '' : v)}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Any severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Any severity</SelectItem>
                {SAFETY_EVENT_SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SAFETY_EVENT_SEVERITY_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status filter */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={filters.status || '_all'}
              onValueChange={(v) => setFilter('status', v === '_all' ? '' : v)}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Any status</SelectItem>
                {SAFETY_EVENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SAFETY_EVENT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear filters */}
          {(filters.dateFrom || filters.dateTo || filters.driverId || filters.truckId || filters.severity || filters.status) && (
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setFilters(prev => ({
                  ...DEFAULT_FILTERS,
                  tab: prev.tab,
                }))}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Result count */}
      {!isLoading && total > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{Math.min(total, PAGE_SIZE)}</span> of{' '}
          <span className="font-medium text-foreground">{total}</span> events
        </p>
      )}

      {/* Event grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No safety events recorded"
          description="Stay safe out there! When you have incidents, claims, or DOT inspections to track, they'll appear here."
          action={{
            label: 'Record New Event',
            onClick: () => handleNewEvent(),
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onEdit={() => handleEdit(event)}
                onDelete={() => handleDelete(event.id)}
                onResolve={() => setResolveEvent(event)}
              />
            ))}
          </div>

          {total > PAGE_SIZE && (
            <Pagination
              page={filters.page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={(page) => setFilters(prev => ({ ...prev, page }))}
            />
          )}
        </>
      )}

      {/* Create / Edit drawer */}
      <EventDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        event={editingEvent}
        defaultEventType={defaultDrawerType}
      />

      {/* Resolve dialog */}
      {resolveEvent && (
        <ResolveDialog
          event={resolveEvent}
          onClose={handleResolveClose}
        />
      )}
    </div>
  )
}
