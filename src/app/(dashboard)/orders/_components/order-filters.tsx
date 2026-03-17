'use client'

import { useBrokers } from '@/hooks/use-brokers'
import { useDrivers } from '@/hooks/use-drivers'
import { ORDER_STATUSES, ORDER_STATUS_LABELS, PAYMENT_STATUSES, PAYMENT_STATUS_LABELS } from '@/types'
import type { OrderStatus, PaymentStatus } from '@/types'
import type { EnhancedFilterConfig, FilterOption, DateRange } from '@/types/filters'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'

// Status pill colors per order status
const ORDER_STATUS_PILL_COLORS: Record<OrderStatus, string> = {
  new: 'bg-blue-500 text-white',
  assigned: 'bg-violet-500 text-white',
  picked_up: 'bg-amber-500 text-white',
  delivered: 'bg-emerald-500 text-white',
  invoiced: 'bg-brand text-white',
  paid: 'bg-emerald-600 text-white',
  cancelled: 'bg-red-500 text-white',
}

interface BrokerOption {
  id: string
  name: string
}

interface DriverOption {
  id: string
  first_name: string
  last_name: string
}

export function getOrderFilterConfigs(
  brokers: BrokerOption[],
  drivers: DriverOption[]
): EnhancedFilterConfig[] {
  const statusOptions: FilterOption[] = ORDER_STATUSES.map((s) => ({
    value: s,
    label: ORDER_STATUS_LABELS[s as OrderStatus],
    color: ORDER_STATUS_PILL_COLORS[s as OrderStatus],
  }))

  const brokerOptions: FilterOption[] = brokers.map((b) => ({
    value: b.id,
    label: b.name,
  }))

  const driverOptions: FilterOption[] = drivers.map((d) => ({
    value: d.id,
    label: `${d.first_name} ${d.last_name}`,
  }))

  const paymentStatusOptions: FilterOption[] = PAYMENT_STATUSES.map((s) => ({
    value: s,
    label: PAYMENT_STATUS_LABELS[s as PaymentStatus],
  }))

  return [
    {
      key: 'status',
      label: 'Status',
      type: 'status-pills',
      options: statusOptions,
    },
    {
      key: 'q',
      label: 'Search',
      type: 'search',
      placeholder: 'Order #, VIN, make...',
    },
    {
      key: 'broker',
      label: 'Broker',
      type: 'select',
      options: brokerOptions,
    },
    {
      key: 'driver',
      label: 'Driver',
      type: 'select',
      options: driverOptions,
    },
    {
      key: 'paymentStatuses',
      label: 'Payment Status',
      type: 'multi-select',
      options: paymentStatusOptions,
    },
    {
      key: 'dateRange',
      label: 'Date Range',
      type: 'date-range',
    },
  ]
}

interface OrderFiltersProps {
  activeFilters: Record<string, string | string[] | DateRange | undefined>
  onFilterChange: (key: string, value: string | string[] | DateRange | undefined) => void
  resultCount?: number
}

export function OrderFilters({ activeFilters, onFilterChange, resultCount }: OrderFiltersProps) {
  const { data: brokersData } = useBrokers({ pageSize: 100 })
  const { data: driversData } = useDrivers({ pageSize: 100 })

  const filterConfig = getOrderFilterConfigs(
    brokersData?.brokers ?? [],
    driversData?.drivers ?? []
  )

  return (
    <EnhancedFilterBar
      filters={filterConfig}
      activeFilters={activeFilters}
      onFilterChange={onFilterChange}
      resultCount={resultCount}
    />
  )
}
