'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar'
import { useBrokers } from '@/hooks/use-brokers'
import { useDrivers } from '@/hooks/use-drivers'
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from '@/types'
import type { OrderStatus } from '@/types'

// Build filter config with dynamic options from hooks
function useFilterConfig(): FilterConfig[] {
  const { data: brokersData } = useBrokers({ pageSize: 100 })
  const { data: driversData } = useDrivers({ pageSize: 100 })

  const statusOptions = ORDER_STATUSES.map((s) => ({
    value: s,
    label: ORDER_STATUS_LABELS[s as OrderStatus],
  }))

  const brokerOptions = (brokersData?.brokers ?? []).map((b) => ({
    value: b.id,
    label: b.name,
  }))

  const driverOptions = (driversData?.drivers ?? []).map((d) => ({
    value: d.id,
    label: `${d.first_name} ${d.last_name}`,
  }))

  return [
    {
      key: 'q',
      label: 'Search',
      type: 'search' as const,
      placeholder: 'Search VIN, make, or order #...',
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: statusOptions,
    },
    {
      key: 'broker',
      label: 'Brokers',
      type: 'select' as const,
      options: brokerOptions,
    },
    {
      key: 'driver',
      label: 'Drivers',
      type: 'select' as const,
      options: driverOptions,
    },
  ]
}

interface OrderFiltersProps {
  activeFilters: Record<string, string>
  onFilterChange: (key: string, value: string | undefined) => void
}

export function OrderFilters({ activeFilters, onFilterChange }: OrderFiltersProps) {
  const filterConfig = useFilterConfig()

  return (
    <FilterBar
      filters={filterConfig}
      onFilterChange={onFilterChange}
      activeFilters={activeFilters}
    />
  )
}
