'use client'

import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { TRIP_STATUSES, TRIP_STATUS_LABELS } from '@/types'
import type { TripStatus } from '@/types'

function useFilterConfig(): FilterConfig[] {
  const { data: driversData } = useDrivers({ pageSize: 100 })
  const { data: trucksData } = useTrucks({ pageSize: 100 })

  const statusOptions = TRIP_STATUSES.map((s) => ({
    value: s,
    label: TRIP_STATUS_LABELS[s as TripStatus],
  }))

  const driverOptions = (driversData?.drivers ?? []).map((d) => ({
    value: d.id,
    label: `${d.first_name} ${d.last_name}`,
  }))

  const truckOptions = (trucksData?.trucks ?? []).map((t) => ({
    value: t.id,
    label: t.unit_number,
  }))

  return [
    {
      key: 'q',
      label: 'Search',
      type: 'search' as const,
      placeholder: 'Search trip number...',
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: statusOptions,
    },
    {
      key: 'driver',
      label: 'Drivers',
      type: 'select' as const,
      options: driverOptions,
    },
    {
      key: 'truck',
      label: 'Trucks',
      type: 'select' as const,
      options: truckOptions,
    },
  ]
}

interface TripFiltersProps {
  activeFilters: Record<string, string>
  onFilterChange: (key: string, value: string | undefined) => void
  startDate: string
  endDate: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
}

export function TripFilters({
  activeFilters,
  onFilterChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: TripFiltersProps) {
  const filterConfig = useFilterConfig()

  return (
    <div className="space-y-3">
      <FilterBar
        filters={filterConfig}
        onFilterChange={onFilterChange}
        activeFilters={activeFilters}
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="start-date" className="text-sm text-muted-foreground whitespace-nowrap">
            From
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value || '')}
            className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="end-date" className="text-sm text-muted-foreground whitespace-nowrap">
            To
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value || '')}
            className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  )
}
