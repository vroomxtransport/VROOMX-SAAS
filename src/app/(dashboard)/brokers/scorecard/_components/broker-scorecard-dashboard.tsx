'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { fetchBrokerScorecard, computeBrokerSummary } from '@/lib/queries/broker-scorecard'
import type { BrokerScore } from '@/lib/queries/broker-scorecard'
import type { DateRange, SortConfig } from '@/types/filters'
import { PeriodSelector } from '@/app/(dashboard)/financials/_components/period-selector'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { Input } from '@/components/ui/input'
import {
  Search,
  X,
  Star,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
} from 'lucide-react'

// ============================================================================
// Grade Badge
// ============================================================================

function gradeStyle(grade: BrokerScore['grade']): string {
  if (grade === 'A') return 'bg-emerald-100 text-emerald-700'
  if (grade === 'B') return 'bg-blue-100 text-blue-700'
  if (grade === 'C') return 'bg-amber-100 text-amber-700'
  if (grade === 'D') return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

function GradeBadge({ grade }: { grade: BrokerScore['grade'] }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
        gradeStyle(grade)
      )}
    >
      {grade}
    </span>
  )
}

// ============================================================================
// Summary Cards
// ============================================================================

function fmt$(val: number): string {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ============================================================================
// Dashboard Props
// ============================================================================

interface BrokerScorecardDashboardProps {
  initialScores: BrokerScore[]
}

// ============================================================================
// Main Component
// ============================================================================

export function BrokerScorecardDashboard({ initialScores }: BrokerScorecardDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortConfig | undefined>({
    field: 'compositeScore',
    direction: 'desc',
  })

  const supabase = createClient()

  const { data: scores } = useQuery({
    queryKey: ['brokers', 'scorecard', dateRange?.from, dateRange?.to],
    queryFn: () => fetchBrokerScorecard(supabase, dateRange),
    initialData: dateRange === undefined ? initialScores : undefined,
    staleTime: 60_000,
  })

  const data = scores ?? initialScores
  const summary = useMemo(() => computeBrokerSummary(data), [data])

  // Client-side search
  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase().trim()
    return data.filter((s) => s.brokerName.toLowerCase().includes(q))
  }, [data, search])

  // Client-side sort
  const sorted = useMemo(() => {
    if (!sort) return filtered
    const { field, direction } = sort
    const mult = direction === 'asc' ? 1 : -1

    return [...filtered].sort((a, b) => {
      const aVal = a[field as keyof BrokerScore]
      const bVal = b[field as keyof BrokerScore]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * mult
      }
      return String(aVal).localeCompare(String(bVal)) * mult
    })
  }, [filtered, sort])

  // Max score for bar scaling
  const maxScore = useMemo(() => Math.max(...sorted.map((s) => s.compositeScore), 1), [sorted])

  // CSV export
  const handleCsvExport = useCallback(async (): Promise<Record<string, unknown>[]> => {
    return sorted.map((s) => ({
      brokerName: s.brokerName,
      grade: s.grade,
      score: s.compositeScore.toFixed(1),
      totalOrders: String(s.totalOrders),
      totalRevenue: s.totalRevenue.toFixed(2),
      avgMarginPct: s.avgMargin.toFixed(1),
      onTimeRatePct: s.onTimeRate.toFixed(1),
      avgDaysToPay: s.avgDaysToPay.toFixed(1),
    }))
  }, [sorted])

  // Margin color helper
  const marginColor = (pct: number) => {
    if (pct >= 20) return 'text-emerald-600'
    if (pct >= 10) return 'text-amber-600'
    return 'text-red-600'
  }

  // OTD color helper
  const otdColor = (pct: number) => {
    if (pct >= 95) return 'text-emerald-600'
    if (pct >= 85) return 'text-amber-600'
    return 'text-red-600'
  }

  const avgScoreGrade = summary.avgScore >= 80 ? 'A'
    : summary.avgScore >= 65 ? 'B'
    : summary.avgScore >= 50 ? 'C'
    : summary.avgScore >= 35 ? 'D'
    : 'F'

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-start justify-between gap-4">
        <PeriodSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total Brokers */}
        <div className="widget-card flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
            <Star className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Total Brokers</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
              {summary.totalBrokers}
            </p>
          </div>
        </div>

        {/* Average Score */}
        <div className="widget-card flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
            <TrendingUp className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Average Score</p>
            <p className="mt-0.5 flex items-baseline gap-1.5 text-2xl font-bold tabular-nums text-foreground">
              {summary.avgScore.toFixed(1)}
              <GradeBadge grade={avgScoreGrade as BrokerScore['grade']} />
            </p>
          </div>
        </div>

        {/* Top Broker */}
        <div className="widget-card flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Top Broker</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
              {summary.topBrokerName}
            </p>
            {data.length > 0 && (
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                Score: {data[0].compositeScore.toFixed(1)}
              </p>
            )}
          </div>
        </div>

        {/* Total Revenue */}
        <div className="widget-card flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
            <DollarSign className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Total Revenue</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
              {fmt$(summary.totalRevenue)}
            </p>
          </div>
        </div>
      </div>

      {/* Scorecard Table */}
      <div className="widget-card">
        <div className="widget-header">
          <h3 className="widget-title">
            <span className="widget-accent-dot bg-brand" />
            Broker Scorecard
          </h3>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search broker..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-[160px] pl-8 text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* CSV Export */}
            <CsvExportButton
              filename="broker-scorecard"
              headers={[
                'brokerName',
                'grade',
                'score',
                'totalOrders',
                'totalRevenue',
                'avgMarginPct',
                'onTimeRatePct',
                'avgDaysToPay',
              ]}
              fetchData={handleCsvExport}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {data.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No broker data available for the selected period.
            </p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No brokers match &quot;{search}&quot;
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="py-2.5 pr-3 text-left">
                    <SortHeader
                      label="Broker"
                      field="brokerName"
                      currentSort={sort}
                      onSort={setSort}
                    />
                  </th>
                  <th className="py-2.5 px-3 text-center">
                    <SortHeader
                      label="Grade"
                      field="grade"
                      currentSort={sort}
                      onSort={setSort}
                      className="justify-center"
                    />
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <SortHeader
                      label="Score"
                      field="compositeScore"
                      currentSort={sort}
                      onSort={setSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <SortHeader
                      label="Orders"
                      field="totalOrders"
                      currentSort={sort}
                      onSort={setSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <SortHeader
                      label="Revenue"
                      field="totalRevenue"
                      currentSort={sort}
                      onSort={setSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <SortHeader
                      label="Margin"
                      field="avgMargin"
                      currentSort={sort}
                      onSort={setSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <SortHeader
                      label="On-Time"
                      field="onTimeRate"
                      currentSort={sort}
                      onSort={setSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="py-2.5 pl-3 text-right">
                    <div className="flex items-center justify-end gap-1 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <SortHeader
                        label="Days to Pay"
                        field="avgDaysToPay"
                        currentSort={sort}
                        onSort={setSort}
                        className="justify-end"
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((broker) => {
                  const scoreBarWidth = Math.min(
                    (broker.compositeScore / maxScore) * 100,
                    100
                  )

                  return (
                    <tr
                      key={broker.brokerId}
                      className="border-b border-border-subtle/50 bg-card transition-colors last:border-0 hover:bg-muted/30"
                    >
                      {/* Broker Name */}
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-foreground">
                          {broker.brokerName}
                        </span>
                        {broker.paidOrders === 0 && broker.deliveredOrders === 0 && (
                          <span className="ml-1.5 text-[11px] text-muted-foreground">
                            (no history)
                          </span>
                        )}
                      </td>

                      {/* Grade */}
                      <td className="py-2.5 px-3 text-center">
                        <GradeBadge grade={broker.grade} />
                      </td>

                      {/* Score with bar background */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="relative inline-flex min-w-[4rem] items-center justify-end">
                          <div
                            className="absolute inset-y-0 right-0 rounded-sm bg-brand/10"
                            style={{ width: `${scoreBarWidth}%` }}
                          />
                          <span className="relative tabular-nums font-semibold text-foreground">
                            {broker.compositeScore.toFixed(1)}
                          </span>
                        </div>
                      </td>

                      {/* Orders */}
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                        {broker.totalOrders}
                      </td>

                      {/* Revenue */}
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium text-foreground">
                        {fmt$(broker.totalRevenue)}
                      </td>

                      {/* Margin % */}
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={cn(
                            'tabular-nums text-xs font-medium',
                            marginColor(broker.avgMargin)
                          )}
                        >
                          {broker.avgMargin.toFixed(1)}%
                        </span>
                      </td>

                      {/* On-Time % */}
                      <td className="py-2.5 px-3 text-right">
                        {broker.deliveredOrders > 0 ? (
                          <span
                            className={cn(
                              'tabular-nums text-xs font-medium',
                              otdColor(broker.onTimeRate)
                            )}
                          >
                            {broker.onTimeRate.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Avg Days to Pay */}
                      <td className="py-2.5 pl-3 text-right">
                        {broker.paidOrders > 0 ? (
                          <span className="tabular-nums text-sm text-muted-foreground">
                            {broker.avgDaysToPay.toFixed(1)}d
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="mt-2 flex items-center justify-between">
              {/* Score legend */}
              <div className="flex items-center gap-3">
                {(
                  [
                    { grade: 'A' as const, label: 'A ≥80' },
                    { grade: 'B' as const, label: 'B ≥65' },
                    { grade: 'C' as const, label: 'C ≥50' },
                    { grade: 'D' as const, label: 'D ≥35' },
                    { grade: 'F' as const, label: 'F <35' },
                  ]
                ).map(({ grade, label }) => (
                  <div key={grade} className="flex items-center gap-1">
                    <GradeBadge grade={grade} />
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Showing {sorted.length} broker{sorted.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Worst broker callout (only when there is enough data) */}
      {data.length >= 3 && (
        <div className="widget-card border-orange-200/60 bg-orange-50/40">
          <div className="flex items-start gap-3">
            <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
            <div>
              <p className="text-xs font-semibold text-orange-700">Lowest Performing Broker</p>
              <p className="mt-0.5 text-sm text-orange-600">
                <span className="font-medium">{summary.worstBrokerName}</span> has the lowest
                composite score in the selected period. Review margin, OTD, and payment terms.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
