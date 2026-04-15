'use client'

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MAINTENANCE_STATUS_LABELS, MAINTENANCE_STATUSES } from '@/types'
import type { MaintenanceStatus } from '@/types'
import type { Shop } from '@/types/database'

export interface WorkOrderFilters {
  status: MaintenanceStatus | ''
  shopId: string
  truckId: string
  dateFrom: string
  dateTo: string
}

interface WorkOrderListFiltersProps {
  filters: WorkOrderFilters
  onFiltersChange: (filters: WorkOrderFilters) => void
  shops: Shop[]
  trucks: Array<{ id: string; unit_number: string; make: string | null; year: number | null }>
}

export function WorkOrderListFilters({
  filters,
  onFiltersChange,
  shops,
  trucks,
}: WorkOrderListFiltersProps) {
  const set = useCallback(
    (patch: Partial<WorkOrderFilters>) => onFiltersChange({ ...filters, ...patch }),
    [filters, onFiltersChange],
  )

  const activeBadges = MAINTENANCE_STATUSES.filter(
    (s) => s !== 'closed',
  ) as MaintenanceStatus[]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status pill filter */}
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => set({ status: '' })}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            filters.status === ''
              ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
              : 'border-border bg-background text-muted-foreground hover:border-[var(--brand)]/50 hover:text-foreground',
          )}
        >
          All
        </button>
        {activeBadges.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => set({ status: s })}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filters.status === s
                ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                : 'border-border bg-background text-muted-foreground hover:border-[var(--brand)]/50 hover:text-foreground',
            )}
          >
            {MAINTENANCE_STATUS_LABELS[s]}
          </button>
        ))}
        {/* Closed is separate since it's terminal */}
        <button
          type="button"
          onClick={() => set({ status: 'closed' })}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            filters.status === 'closed'
              ? 'border-zinc-600 bg-zinc-700 text-white'
              : 'border-border bg-background text-muted-foreground hover:border-zinc-400 hover:text-foreground',
          )}
        >
          Closed
        </button>
      </div>

      <div className="flex flex-wrap gap-2 ml-auto">
        {/* Shop filter */}
        {shops.length > 0 && (
          <Select
            value={filters.shopId || 'all'}
            onValueChange={(v) => set({ shopId: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="All shops" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All shops</SelectItem>
              {shops.map((shop) => (
                <SelectItem key={shop.id} value={shop.id}>
                  {shop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Truck filter */}
        {trucks.length > 0 && (
          <Select
            value={filters.truckId || 'all'}
            onValueChange={(v) => set({ truckId: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="All trucks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trucks</SelectItem>
              {trucks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.unit_number}
                  {t.make ? ` — ${t.year ?? ''} ${t.make}`.trim() : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Date range */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set({ dateFrom: e.target.value })}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/50"
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set({ dateTo: e.target.value })}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/50"
            aria-label="To date"
          />
        </div>
      </div>
    </div>
  )
}
