'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { StatCard } from '@/components/shared/stat-card'
import { ComplianceScoreCard } from './compliance-score-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  FileX,
  ArrowRight,
  Car,
  Shield,
  Activity,
  FileText,
} from 'lucide-react'
import type { ComplianceDocument, SafetyEvent, Driver, Truck } from '@/types/database'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function expiryBucketStyle(days: number): {
  dot: string
  badge: string
  label: string
} {
  if (days < 0)
    return {
      dot: 'bg-red-500',
      badge: 'text-red-700',
      label: 'Expired',
    }
  if (days <= 7)
    return {
      dot: 'bg-red-500',
      badge: 'text-red-700',
      label: `${days}d`,
    }
  if (days <= 30)
    return {
      dot: 'bg-amber-500',
      badge: 'text-amber-700',
      label: `${days}d`,
    }
  return {
    dot: 'bg-yellow-400',
    badge: 'text-yellow-700',
    label: `${days}d`,
  }
}

function severityStyle(
  severity: SafetyEvent['severity']
): string {
  switch (severity) {
    case 'critical':
      return 'text-red-700 border-red-200'
    case 'severe':
      return 'text-orange-700 border-orange-200'
    case 'moderate':
      return 'text-amber-700 border-amber-200'
    default:
      return 'text-blue-700 border-blue-200'
  }
}

function statusStyle(status: SafetyEvent['status']): string {
  switch (status) {
    case 'open':
      return 'text-red-700 border-red-200'
    case 'under_review':
      return 'text-amber-700 border-amber-200'
    case 'resolved':
      return 'text-emerald-700 border-emerald-200'
    case 'closed':
      return 'bg-muted text-muted-foreground border-border'
  }
}

function eventTypeIcon(type: SafetyEvent['event_type']) {
  switch (type) {
    case 'incident':
      return <Car className="h-4 w-4" />
    case 'claim':
      return <Shield className="h-4 w-4" />
    case 'dot_inspection':
      return <Activity className="h-4 w-4" />
  }
}

// ─── Fetch helpers (inline TanStack Query) ────────────────────────────────────

async function fetchExpiringDocs(supabase: ReturnType<typeof createClient>): Promise<ComplianceDocument[]> {
  const in60Days = new Date()
  in60Days.setDate(in60Days.getDate() + 60)

  const { data, error } = await supabase
    .from('compliance_documents')
    .select('*')
    .not('expires_at', 'is', null)
    .lte('expires_at', in60Days.toISOString())
    .order('expires_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as ComplianceDocument[]
}

async function fetchRecentEvents(supabase: ReturnType<typeof createClient>): Promise<SafetyEvent[]> {
  const { data, error } = await supabase
    .from('safety_events')
    .select('*, driver:driver_id(id, first_name, last_name), truck:truck_id(id, unit_number, make, model)')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) throw error
  return (data ?? []) as SafetyEvent[]
}

async function fetchOpenEventCount(supabase: ReturnType<typeof createClient>): Promise<number> {
  const { count, error } = await supabase
    .from('safety_events')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'under_review'])

  if (error) throw error
  return count ?? 0
}

interface EntityScore {
  id: string
  name: string
  docCount: number
  requiredCount: number
  score: number
}

async function fetchDriverScores(supabase: ReturnType<typeof createClient>): Promise<EntityScore[]> {
  const [{ data: drivers }, { data: docs }] = await Promise.all([
    supabase
      .from('drivers')
      .select('id, first_name, last_name')
      .eq('driver_status', 'active')
      .order('first_name', { ascending: true })
      .limit(10),
    supabase
      .from('compliance_documents')
      .select('entity_id, is_required')
      .eq('entity_type', 'driver'),
  ])

  if (!drivers) return []

  const docsByDriver = new Map<string, { total: number; required: number }>()
  ;(docs ?? []).forEach((d) => {
    if (!d.entity_id) return
    const existing = docsByDriver.get(d.entity_id) ?? { total: 0, required: 0 }
    docsByDriver.set(d.entity_id, {
      total: existing.total + 1,
      required: existing.required + (d.is_required ? 1 : 0),
    })
  })

  return (drivers as Pick<Driver, 'id' | 'first_name' | 'last_name'>[]).map((driver) => {
    const counts = docsByDriver.get(driver.id) ?? { total: 0, required: 0 }
    // Baseline: 5 required DQF docs per driver
    const requiredCount = Math.max(counts.required, 5)
    const docCount = Math.min(counts.total, requiredCount)
    const score = requiredCount > 0 ? Math.round((docCount / requiredCount) * 100) : 0
    return {
      id: driver.id,
      name: `${driver.first_name} ${driver.last_name}`,
      docCount,
      requiredCount,
      score,
    }
  })
}

async function fetchTruckScores(supabase: ReturnType<typeof createClient>): Promise<EntityScore[]> {
  const [{ data: trucks }, { data: docs }] = await Promise.all([
    supabase
      .from('trucks')
      .select('id, unit_number, make, model')
      .eq('truck_status', 'active')
      .order('unit_number', { ascending: true })
      .limit(10),
    supabase
      .from('compliance_documents')
      .select('entity_id, is_required')
      .eq('entity_type', 'truck'),
  ])

  if (!trucks) return []

  const docsByTruck = new Map<string, { total: number; required: number }>()
  ;(docs ?? []).forEach((d) => {
    if (!d.entity_id) return
    const existing = docsByTruck.get(d.entity_id) ?? { total: 0, required: 0 }
    docsByTruck.set(d.entity_id, {
      total: existing.total + 1,
      required: existing.required + (d.is_required ? 1 : 0),
    })
  })

  return (trucks as Pick<Truck, 'id' | 'unit_number' | 'make' | 'model'>[]).map((truck) => {
    const counts = docsByTruck.get(truck.id) ?? { total: 0, required: 0 }
    // Baseline: 4 required vehicle docs per truck
    const requiredCount = Math.max(counts.required, 4)
    const docCount = Math.min(counts.total, requiredCount)
    const score = requiredCount > 0 ? Math.round((docCount / requiredCount) * 100) : 0
    const label = truck.make && truck.model
      ? `Unit ${truck.unit_number} – ${truck.make} ${truck.model}`
      : `Unit ${truck.unit_number}`
    return { id: truck.id, name: label, docCount, requiredCount, score }
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('widget-card', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 rounded-full bg-muted/50 p-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ─── KPI computation from raw data ───────────────────────────────────────────

function computeOverallCompliance(
  driverScores: EntityScore[],
  truckScores: EntityScore[]
): number {
  const all = [...driverScores, ...truckScores]
  if (all.length === 0) return 0
  return Math.round(all.reduce((sum, e) => sum + e.score, 0) / all.length)
}

function computeMissingDocs(
  driverScores: EntityScore[],
  truckScores: EntityScore[]
): number {
  return [...driverScores, ...truckScores].reduce(
    (sum, e) => sum + Math.max(0, e.requiredCount - e.docCount),
    0
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ComplianceOverview() {
  const supabase = createClient()

  const { data: expiringDocs = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['compliance-expiring-docs'],
    queryFn: () => fetchExpiringDocs(supabase),
    staleTime: 30_000,
  })

  const { data: recentEvents = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['compliance-recent-events'],
    queryFn: () => fetchRecentEvents(supabase),
    staleTime: 30_000,
  })

  const { data: openEventCount = 0 } = useQuery({
    queryKey: ['compliance-open-event-count'],
    queryFn: () => fetchOpenEventCount(supabase),
    staleTime: 30_000,
  })

  const { data: driverScores = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ['compliance-driver-scores'],
    queryFn: () => fetchDriverScores(supabase),
    staleTime: 30_000,
  })

  const { data: truckScores = [], isLoading: loadingTrucks } = useQuery({
    queryKey: ['compliance-truck-scores'],
    queryFn: () => fetchTruckScores(supabase),
    staleTime: 30_000,
  })

  const overallCompliance = computeOverallCompliance(driverScores, truckScores)
  const missingDocs = computeMissingDocs(driverScores, truckScores)
  const expiringIn30d = expiringDocs.filter((d) => {
    const days = daysUntil(d.expires_at!)
    return days <= 30
  }).length

  const complianceAccent =
    overallCompliance >= 80 ? 'emerald' : overallCompliance >= 50 ? 'amber' : 'amber'

  const isLoading = loadingDocs || loadingEvents || loadingDrivers || loadingTrucks

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Skeleton KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
        {/* Skeleton body */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />
            <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />
            <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Overall Compliance"
          value={`${overallCompliance}%`}
          sublabel={driverScores.length + truckScores.length > 0 ? `${driverScores.length + truckScores.length} entities tracked` : 'No entities yet'}
          icon={ShieldCheck}
          accent={complianceAccent}
        />
        <StatCard
          label="Expiring (30 days)"
          value={expiringIn30d}
          sublabel="documents"
          icon={Clock}
          accent="amber"
        />
        <StatCard
          label="Open Safety Events"
          value={openEventCount}
          sublabel="need attention"
          icon={AlertTriangle}
          accent="amber"
        />
        <StatCard
          label="Missing Required Docs"
          value={missingDocs}
          sublabel="across all entities"
          icon={FileX}
          accent="amber"
        />
      </div>

      {/* ── Body: 2/3 + 1/3 ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Left column (wider) */}
        <div className="lg:col-span-2 space-y-4">

          {/* Expiring Documents */}
          <SectionCard
            title="Expiring Documents"
            action={
              <Link href="/compliance/dqf">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            }
          >
            {expiringDocs.length === 0 ? (
              <EmptyState
                icon={FileText}
                message="No documents expiring in the next 60 days. Get started by uploading your first document."
              />
            ) : (
              <div className="divide-y divide-border">
                {expiringDocs.map((doc) => {
                  const days = daysUntil(doc.expires_at!)
                  const bucket = expiryBucketStyle(days)
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', bucket.dot)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {doc.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {doc.entity_type === 'driver'
                            ? 'Driver file'
                            : doc.entity_type === 'truck'
                              ? 'Vehicle file'
                              : 'Company file'}{' '}
                          &middot; Expires {formatDate(doc.expires_at!)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                          bucket.badge
                        )}
                      >
                        {bucket.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Recent Safety Events */}
          <SectionCard
            title="Recent Safety Events"
            action={
              <Link href="/compliance/events">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            }
          >
            {recentEvents.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                message="No safety events recorded. Keeping a clean record is a great sign."
              />
            ) : (
              <div className="divide-y divide-border">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="mt-0.5 shrink-0 rounded-lg bg-muted p-1.5 text-muted-foreground">
                      {eventTypeIcon(event.event_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {event.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(event.event_date)} &middot;{' '}
                        <span className="capitalize">{event.event_type.replace('_', ' ')}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn('text-xs capitalize', severityStyle(event.severity))}
                      >
                        {event.severity}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn('text-xs capitalize', statusStyle(event.status))}
                      >
                        {event.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right column (narrower) */}
        <div className="space-y-4">

          {/* Driver Compliance */}
          <SectionCard
            title="Driver Compliance"
            action={
              <Link href="/compliance/dqf">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  Full view <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            }
          >
            {driverScores.length === 0 ? (
              <EmptyState
                icon={FileText}
                message="Add drivers and upload their qualification files to track compliance."
              />
            ) : (
              <div className="divide-y divide-border">
                {driverScores.map((driver) => (
                  <ComplianceScoreCard
                    key={driver.id}
                    entityName={driver.name}
                    score={driver.score}
                    docCount={driver.docCount}
                    requiredCount={driver.requiredCount}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Vehicle Compliance */}
          <SectionCard
            title="Vehicle Compliance"
            action={
              <Link href="/compliance/vehicle">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  Full view <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            }
          >
            {truckScores.length === 0 ? (
              <EmptyState
                icon={FileText}
                message="Add trucks and upload their inspection files to track vehicle compliance."
              />
            ) : (
              <div className="divide-y divide-border">
                {truckScores.map((truck) => (
                  <ComplianceScoreCard
                    key={truck.id}
                    entityName={truck.name}
                    score={truck.score}
                    docCount={truck.docCount}
                    requiredCount={truck.requiredCount}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
