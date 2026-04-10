'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useTruck } from '@/hooks/use-trucks'
import { useTruckExpenses } from '@/hooks/use-truck-expenses'
import {
  getTruckMonthlyPnl,
  type LedgerDateRange,
} from '@/lib/queries/truck-expense-ledger'
import { fetchFleetUtilization } from '@/lib/queries/fleet-utilization'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Truck as TruckIcon } from 'lucide-react'
import { DateRangePicker } from '@/components/shared/date-range-picker'
import type { DateRange } from '@/types/filters'
import { TruckPnlKpis } from './_components/truck-pnl-kpis'
import { TruckPnlChart } from './_components/truck-pnl-chart'
import { TruckExpenseBreakdown } from './_components/truck-expense-breakdown'
import { TruckExpenseLedger } from './_components/truck-expense-ledger'
import { AddExpenseDialog } from './_components/add-expense-dialog'

interface PageProps {
  params: Promise<{ id: string }>
}

function defaultDateRange(): DateRange {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  return {
    from: start.toISOString(),
    to: end.toISOString(),
  }
}

function dateRangeToLedger(range: DateRange): LedgerDateRange {
  return {
    from: range.from.slice(0, 10),
    to: range.to.slice(0, 10),
  }
}

export default function TruckFinancialsPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange())
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const ledgerRange = useMemo(() => dateRangeToLedger(dateRange), [dateRange])

  const { data: truck, isLoading: truckLoading } = useTruck(id)

  const { data: fleet, isLoading: fleetLoading } = useQuery({
    queryKey: ['fleet-utilization', dateRange.from, dateRange.to],
    queryFn: () => fetchFleetUtilization(supabase, dateRange),
    staleTime: 30_000,
  })

  const { data: monthlyPnl, isLoading: monthlyLoading } = useQuery({
    queryKey: ['truck-monthly-pnl', id],
    queryFn: () => getTruckMonthlyPnl(supabase, id),
    staleTime: 30_000,
  })

  const {
    entries,
    summary,
    isLoading: ledgerLoading,
  } = useTruckExpenses(id, ledgerRange)

  // Pull trips for the current period so the Add Expense dialog can offer a
  // trip picker for trip-scoped categories (tolls/lodging/misc).
  const { data: periodTrips } = useQuery({
    queryKey: ['truck-period-trips', id, ledgerRange.from, ledgerRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('id, trip_number, start_date, end_date')
        .eq('truck_id', id)
        .lte('start_date', ledgerRange.to)
        .gte('end_date', ledgerRange.from)
        .order('start_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })

  const tripOptions = useMemo(
    () =>
      (periodTrips ?? []).map((t) => ({
        id: t.id as string,
        label: `${(t.trip_number as string | null) ?? 'Trip'} · ${(t.start_date as string).slice(0, 10)} → ${(t.end_date as string).slice(0, 10)}`,
      })),
    [periodTrips],
  )

  // Resolve this truck's utilization slice + fleet averages for the KPI strip.
  const thisTruckUtil = useMemo(() => {
    if (!fleet) return null
    return fleet.find((u) => u.truckId === id) ?? null
  }, [fleet, id])

  const fleetAverages = useMemo(() => {
    if (!fleet || fleet.length === 0) {
      return { avgRpm: null, avgProfitPerMile: null, avgUtilization: 0 }
    }
    const withRpm = fleet.filter((u) => u.revenuePerMile !== null)
    const withPpm = fleet.filter((u) => u.profitPerMile !== null)
    const avgRpm = withRpm.length
      ? withRpm.reduce((s, u) => s + (u.revenuePerMile ?? 0), 0) / withRpm.length
      : null
    const avgProfitPerMile = withPpm.length
      ? withPpm.reduce((s, u) => s + (u.profitPerMile ?? 0), 0) / withPpm.length
      : null
    const avgUtilization =
      fleet.reduce((s, u) => s + u.utilizationPct, 0) / fleet.length
    return { avgRpm, avgProfitPerMile, avgUtilization }
  }, [fleet])

  const unitNumber = truck?.unit_number
  useEffect(() => {
    document.title = unitNumber ? `${unitNumber} · P&L — VroomX` : 'Truck P&L — VroomX'
  }, [unitNumber])

  if (truckLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-[240px]" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[108px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    )
  }

  if (!truck) {
    return (
      <div className="py-16 text-center">
        <TruckIcon className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-2 text-lg font-semibold text-foreground">Truck not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The truck you are looking for does not exist or has been removed.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/trucks')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Fleet
        </Button>
      </div>
    )
  }

  const vehicleLine = [truck.year, truck.make, truck.model].filter(Boolean).join(' ')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/trucks/${id}`)}
          className="mb-3 -ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to truck
        </Button>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TruckIcon className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {truck.unit_number} P&amp;L
              </h1>
            </div>
            {vehicleLine && (
              <p className="mt-1 text-sm text-muted-foreground">{vehicleLine}</p>
            )}
          </div>

          <DateRangePicker value={dateRange} onChange={(r) => r && setDateRange(r)} />
        </div>
      </div>

      {/* KPIs — gate on BOTH fleet and ledger loading so the KPI row never
          shows trip-table-only expenses before the unified ledger finishes.
          Otherwise "Expenses" briefly reads low and "Net Profit" briefly
          reads inflated on every page load. */}
      {fleetLoading || ledgerLoading ? (
        <Skeleton className="h-[232px] rounded-xl" />
      ) : (
        <TruckPnlKpis
          utilization={thisTruckUtil}
          summary={summary}
          fleetAvgRpm={fleetAverages.avgRpm}
          fleetAvgProfitPerMile={fleetAverages.avgProfitPerMile}
          fleetAvgUtilization={fleetAverages.avgUtilization}
        />
      )}

      {/* Chart + breakdown */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        {monthlyLoading ? (
          <Skeleton className="h-[360px] rounded-xl" />
        ) : (
          <TruckPnlChart data={monthlyPnl ?? []} />
        )}
        <TruckExpenseBreakdown summary={summary} />
      </div>

      {/* Ledger */}
      <TruckExpenseLedger
        entries={entries}
        isLoading={ledgerLoading}
        onAddExpense={() => setAddDialogOpen(true)}
      />

      {/* Add expense dialog */}
      <AddExpenseDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        truckId={id}
        trips={tripOptions}
      />
    </div>
  )
}
