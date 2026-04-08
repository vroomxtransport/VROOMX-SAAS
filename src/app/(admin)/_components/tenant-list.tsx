'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { fetchTenants } from '@/app/actions/admin'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { SortHeader } from '@/components/shared/sort-header'
import { Pagination } from '@/components/shared/pagination'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, ExternalLink } from 'lucide-react'
import type { EnhancedFilterConfig, SortConfig, DateRange } from '@/types/filters'

// ── Plan badge colours ─────────────────────────────────────────────────────────
const PLAN_COLORS: Record<string, string> = {
  owner_operator: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  starter_x:      'bg-brand/10 text-brand border-brand/20',
  pro_x:          'bg-blue-50 text-blue-700 border-blue-200',
}

const PLAN_LABELS: Record<string, string> = {
  owner_operator: 'Owner-Operator',
  starter_x:      'Starter X',
  pro_x:          'Pro X',
}

// ── Subscription status badge colours ─────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  trialing: 'bg-blue-50 text-blue-700 border-blue-200',
  past_due: 'bg-amber-50 text-amber-700 border-amber-200',
  canceled: 'bg-gray-50 text-gray-500 border-gray-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  unpaid: 'bg-orange-50 text-orange-700 border-orange-200',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past Due',
  canceled: 'Canceled',
  suspended: 'Suspended',
  unpaid: 'Unpaid',
}

// ── Filter config ──────────────────────────────────────────────────────────────
const filterConfig: EnhancedFilterConfig[] = [
  {
    key: 'q',
    label: 'Search',
    type: 'search',
    placeholder: 'Name, slug, DOT#...',
  },
  {
    key: 'plan',
    label: 'Plan',
    type: 'select',
    options: [
      { value: 'owner_operator', label: 'Owner-Operator' },
      { value: 'starter_x',      label: 'Starter X' },
      { value: 'pro_x',          label: 'Pro X' },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    type: 'status-pills',
    options: [
      { value: 'active', label: 'Active', color: 'bg-emerald-500 text-white' },
      { value: 'trialing', label: 'Trialing', color: 'bg-blue-500 text-white' },
      { value: 'past_due', label: 'Past Due', color: 'bg-amber-500 text-white' },
      { value: 'canceled', label: 'Canceled', color: 'bg-gray-500 text-white' },
      { value: 'suspended', label: 'Suspended', color: 'bg-red-500 text-white' },
    ],
  },
]

// ── Types inferred from fetchTenants return ────────────────────────────────────
type TenantRow = {
  id: string
  name: string
  slug: string
  plan: string
  subscription_status: string
  is_suspended: boolean
  created_at: string
  dot_number?: string | null
  trial_ends_at?: string | null
  truck_limit?: number | null
  userCount: number
  truckCount: number
}

// ── Table skeleton ─────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="border-b border-border bg-muted/50 px-4 py-2.5">
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-24 ml-auto" />
        </div>
      ))}
    </div>
  )
}

// ── Effective status (suspended overrides subscription_status) ─────────────────
function effectiveStatus(tenant: TenantRow): string {
  if (tenant.is_suspended) return 'suspended'
  return tenant.subscription_status
}

// ── Main component ─────────────────────────────────────────────────────────────
export function TenantList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const search = searchParams.get('q') ?? undefined
  // Narrow the URL plan param to the SubscriptionPlan union — fetchTenants
  // will reject anything else at the Zod boundary, so filter client-side.
  const rawPlan = searchParams.get('plan')
  const plan: 'owner_operator' | 'starter_x' | 'pro_x' | undefined =
    rawPlan === 'owner_operator' || rawPlan === 'starter_x' || rawPlan === 'pro_x'
      ? rawPlan
      : undefined
  const status = searchParams.get('status') ?? undefined
  const sortBy = searchParams.get('sortBy') ?? 'created_at'
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc') ?? 'desc'
  const page = parseInt(searchParams.get('page') ?? '0', 10)

  const sort: SortConfig = { field: sortBy, direction: sortDir }

  const [pageSize, setPageSize] = useState(25)

  // Data state
  const [data, setData] = useState<{ tenants: TenantRow[]; total: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetchTenants({
      search,
      plan,
      status,
      sortBy,
      sortDir,
      page: page + 1, // action uses 1-based pages
      pageSize,
    }).then((result) => {
      if (cancelled) return
      if ('error' in result) {
        setError(typeof result.error === 'string' ? result.error : 'Failed to load tenants')
        setData(null)
      } else {
        setData({ tenants: result.data.tenants as TenantRow[], total: result.data.total })
      }
      setIsLoading(false)
    })

    return () => { cancelled = true }
  }, [search, plan, status, sortBy, sortDir, page, pageSize])

  // ── URL param helpers ──────────────────────────────────────────────────────
  const setFilter = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && typeof value === 'string') {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.set('page', '0')
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const handleSort = useCallback(
    (newSort: SortConfig | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (newSort) {
        params.set('sortBy', newSort.field)
        params.set('sortDir', newSort.direction)
      } else {
        params.delete('sortBy')
        params.delete('sortDir')
      }
      params.set('page', '0')
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', '0')
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const setPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(newPage))
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const activeFilters: Record<string, string | string[] | DateRange | undefined> = {}
  if (search) activeFilters.q = search
  if (plan) activeFilters.plan = plan
  if (status) activeFilters.status = status

  const tenants = data?.tenants ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tenants"
        subtitle="View and manage all carrier tenants on the platform."
      />

      <EnhancedFilterBar
        filters={filterConfig}
        activeFilters={activeFilters}
        onFilterChange={setFilter}
        resultCount={data ? total : undefined}
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : tenants.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-border bg-surface">
          <Building2 className="h-10 w-10 text-muted-foreground/60 mb-4" />
          <p className="text-sm font-medium text-foreground">No tenants found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your filters or search query.
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_100px_120px_90px_70px_120px_80px] gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
              <SortHeader label="Name" field="name" currentSort={sort} onSort={handleSort} />
              <span className="text-xs font-medium text-muted-foreground">Plan</span>
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <span className="text-xs font-medium text-muted-foreground">Trucks</span>
              <span className="text-xs font-medium text-muted-foreground">Users</span>
              <SortHeader label="Created" field="created_at" currentSort={sort} onSort={handleSort} />
              <span className="sr-only">Actions</span>
            </div>

            {/* Rows */}
            {tenants.map((tenant) => {
              const eff = effectiveStatus(tenant)
              return (
                <div
                  key={tenant.id}
                  className="grid grid-cols-[1fr_100px_120px_90px_70px_120px_80px] gap-2 items-center border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  {/* Name + slug */}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{tenant.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{tenant.slug}</p>
                  </div>

                  {/* Plan */}
                  <div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${PLAN_COLORS[tenant.plan] ?? ''}`}
                    >
                      {PLAN_LABELS[tenant.plan] ?? tenant.plan}
                    </Badge>
                  </div>

                  {/* Status */}
                  <div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${STATUS_COLORS[eff] ?? ''}`}
                    >
                      {STATUS_LABELS[eff] ?? eff}
                    </Badge>
                  </div>

                  {/* Trucks count / limit */}
                  <div className="text-sm text-muted-foreground tabular-nums">
                    {tenant.truckCount}
                    {tenant.truck_limit != null && (
                      <span className="text-muted-foreground/50">/{tenant.truck_limit}</span>
                    )}
                  </div>

                  {/* Users count */}
                  <div className="text-sm text-muted-foreground tabular-nums">
                    {tenant.userCount}
                  </div>

                  {/* Created date */}
                  <div className="text-sm text-muted-foreground">
                    {new Date(tenant.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>

                  {/* View action */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                    >
                      View
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}
    </div>
  )
}
