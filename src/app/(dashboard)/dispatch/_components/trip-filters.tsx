'use client'

import { useMemo } from 'react'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { TRIP_STATUSES, TRIP_STATUS_LABELS } from '@/types'
import type { TripStatus } from '@/types'
import type { EnhancedFilterConfig, DateRange } from '@/types/filters'

// Status pill color map (active state classes)
const STATUS_PILL_COLORS: Record<TripStatus, string> = {
  planned: 'bg-blue-500 text-white',
  in_progress: 'bg-amber-500 text-white',
  at_terminal: 'bg-violet-500 text-white',
  completed: 'bg-emerald-500 text-white',
}

function useTripFilterConfig(): EnhancedFilterConfig[] {
  const { data: driversData } = useDrivers({ pageSize: 100 })
  const { data: trucksData } = useTrucks({ pageSize: 100 })

  return useMemo(() => {
    const statusOptions = TRIP_STATUSES.map((s) => ({
      value: s,
      label: TRIP_STATUS_LABELS[s as TripStatus],
      color: STATUS_PILL_COLORS[s as TripStatus],
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
        key: 'status',
        label: 'Status',
        type: 'status-pills' as const,
        options: statusOptions,
      },
      {
        key: 'q',
        label: 'Search',
        type: 'search' as const,
        placeholder: 'Trip #...',
      },
      {
        key: 'driver',
        label: 'Driver',
        type: 'select' as const,
        options: driverOptions,
      },
      {
        key: 'truck',
        label: 'Truck',
        type: 'select' as const,
        options: truckOptions,
      },
      {
        key: 'dateRange',
        label: 'Trip Dates',
        type: 'date-range' as const,
      },
    ]
  }, [driversData, trucksData])
}

interface TripFiltersProps {
  activeFilters: Record<string, string | string[] | DateRange | undefined>
  onFilterChange: (key: string, value: string | string[] | DateRange | undefined) => void
  resultCount?: number
}

export function TripFilters({
  activeFilters,
  onFilterChange,
  resultCount,
}: TripFiltersProps) {
  const filterConfig = useTripFilterConfig()

  return (
    <EnhancedFilterBar
      filters={filterConfig}
      activeFilters={activeFilters}
      onFilterChange={onFilterChange}
      resultCount={resultCount}
    />
  )
}
