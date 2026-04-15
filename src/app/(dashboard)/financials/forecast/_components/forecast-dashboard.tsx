'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, DollarSign, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ForecastChart } from '@/components/reports/forecast-chart'
import { linearForecast, breakEvenForecast } from '@/lib/financial/forecasting'
import type { MonthlyKPITrend } from '@/lib/queries/financials'
import type { DataPoint } from '@/lib/financial/forecasting'

// ============================================================================
// Types
// ============================================================================

interface ForecastDashboardProps {
  kpiTrend: MonthlyKPITrend[]
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000)
    return `$${(value / 1_000).toFixed(0)}K`
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Convert MonthlyKPITrend month label ('Jan 2026') to 'yyyy-MM' period key.
 * Fallback: keep original string if parsing fails.
 */
function labelToPeriod(label: string): string {
  try {
    const d = new Date(`${label} 01`)
    if (isNaN(d.getTime())) return label
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  } catch {
    return label
  }
}

// ============================================================================
// Summary Card
// ============================================================================

interface SummaryCardProps {
  label: string
  value: string
  subLabel?: string
  trend?: 'up' | 'down' | 'flat'
  icon: React.ElementType
  accent?: boolean
}

function SummaryCard({ label, value, subLabel, trend, icon: Icon, accent }: SummaryCardProps) {
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  const trendColor =
    trend === 'up'
      ? 'text-emerald-600'
      : trend === 'down'
        ? 'text-rose-500'
        : 'text-muted-foreground'

  return (
    <div className={cn('widget-card flex flex-col gap-3', accent && 'widget-card-primary')}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <span className="rounded-md bg-surface-raised p-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
        {subLabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{subLabel}</p>
        )}
      </div>
      {trend && (
        <div className={cn('flex items-center gap-1', trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span className="text-xs font-medium capitalize">{trend === 'flat' ? 'Stable trend' : `${trend === 'up' ? 'Improving' : 'Declining'} trend`}</span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Break-Even Status Card
// ============================================================================

interface BreakEvenCardProps {
  revenueData: DataPoint[]
  costData: DataPoint[]
}

function BreakEvenCard({ revenueData, costData }: BreakEvenCardProps) {
  const breakEvenData = useMemo(() => {
    const combined = revenueData
      .map((r) => {
        const c = costData.find((d) => d.period === r.period)
        return c ? { period: r.period, revenue: r.value, costs: c.value } : null
      })
      .filter((d): d is { period: string; revenue: number; costs: number } => d !== null)

    return breakEvenForecast(combined, 3)
  }, [revenueData, costData])

  if (breakEvenData.length === 0) {
    return (
      <div className="widget-card flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Break-Even Status</p>
        <p className="text-sm text-muted-foreground">Insufficient data for break-even projection</p>
      </div>
    )
  }

  const nextMonth = breakEvenData[0]
  const allBreakEven = breakEvenData.every((d) => d.breakEvenReached)
  const noneBreakEven = breakEvenData.every((d) => !d.breakEvenReached)

  return (
    <div className="widget-card flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Break-Even Status</p>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex h-2.5 w-2.5 rounded-full',
            nextMonth.breakEvenReached ? 'bg-emerald-500' : 'bg-rose-500'
          )}
        />
        <p className="text-sm font-semibold text-foreground">
          {nextMonth.breakEvenReached ? 'Revenue covers costs' : 'Below break-even'}
        </p>
      </div>
      <div className="space-y-1.5">
        {breakEvenData.map((d) => (
          <div key={d.period} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{d.period}</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-foreground font-medium">
                {formatCurrency(d.projectedRevenue)}
              </span>
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium',
                  d.breakEvenReached
                    ? 'text-emerald-700'
                    : 'text-rose-600'
                )}
              >
                {d.breakEvenReached ? 'Profitable' : 'Loss'}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {allBreakEven
          ? 'All projected months are profitable.'
          : noneBreakEven
            ? 'Projected months show operating at a loss.'
            : 'Mixed profitability across projected months.'}
      </p>
    </div>
  )
}

// ============================================================================
// Main Dashboard
// ============================================================================

export function ForecastDashboard({ kpiTrend }: ForecastDashboardProps) {
  // Convert month labels to 'yyyy-MM' period keys for the forecasting engine
  const revenueData: DataPoint[] = useMemo(
    () => kpiTrend.map((m) => ({ period: labelToPeriod(m.month), value: m.revenue })),
    [kpiTrend]
  )

  const profitData: DataPoint[] = useMemo(
    () =>
      kpiTrend.map((m) => ({
        period: labelToPeriod(m.month),
        value: m.revenue - m.expenses,
      })),
    [kpiTrend]
  )

  const cpmData: DataPoint[] = useMemo(
    () =>
      kpiTrend
        .filter((m) => m.cpm !== null)
        .map((m) => ({ period: labelToPeriod(m.month), value: m.cpm as number })),
    [kpiTrend]
  )

  const costData: DataPoint[] = useMemo(
    () => kpiTrend.map((m) => ({ period: labelToPeriod(m.month), value: m.expenses })),
    [kpiTrend]
  )

  // Compute forecasts — 3 months ahead
  const revenueForecast = useMemo(() => linearForecast(revenueData, 3), [revenueData])
  const profitForecast = useMemo(() => linearForecast(profitData, 3), [profitData])
  const cpmForecast = useMemo(() => linearForecast(cpmData, 3), [cpmData])

  // Next-month projected values for summary cards
  const nextRevenue = revenueForecast.projected[0]?.value ?? null
  const nextProfit = profitForecast.projected[0]?.value ?? null

  const hasEnoughData = kpiTrend.length >= 3

  if (!hasEnoughData) {
    return (
      <div className="widget-card flex flex-col items-center justify-center py-12 text-center gap-3">
        <BarChart2 className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold text-foreground">Not enough data for forecasting</p>
          <p className="text-xs text-muted-foreground mt-1">
            At least 3 months of financial data is required to generate projections.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Projected Revenue"
          value={nextRevenue !== null ? formatCurrency(nextRevenue) : 'N/A'}
          subLabel="Next month estimate"
          trend={revenueForecast.trend}
          icon={DollarSign}
          accent
        />
        <SummaryCard
          label="Projected Profit"
          value={nextProfit !== null ? formatCurrency(nextProfit) : 'N/A'}
          subLabel="Next month estimate"
          trend={profitForecast.trend}
          icon={TrendingUp}
        />
        <SummaryCard
          label="Revenue Trend"
          value={`${revenueForecast.avgGrowthRate >= 0 ? '+' : ''}${revenueForecast.avgGrowthRate.toFixed(1)}%`}
          subLabel="Avg monthly growth"
          trend={revenueForecast.trend}
          icon={BarChart2}
        />
        <SummaryCard
          label="Profit Trend"
          value={`${profitForecast.avgGrowthRate >= 0 ? '+' : ''}${profitForecast.avgGrowthRate.toFixed(1)}%`}
          subLabel="Avg monthly growth"
          trend={profitForecast.trend}
          icon={TrendingUp}
        />
      </div>

      {/* Forecast Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="widget-card">
          <ForecastChart
            title="Revenue Forecast"
            historical={revenueForecast.historical}
            projected={revenueForecast.projected}
            confidence={revenueForecast.confidence}
            format="currency"
          />
        </div>
        <div className="widget-card">
          <ForecastChart
            title="Net Profit Forecast"
            historical={profitForecast.historical}
            projected={profitForecast.projected}
            confidence={profitForecast.confidence}
            format="currency"
          />
        </div>
        <div className="widget-card">
          {cpmData.length >= 3 ? (
            <ForecastChart
              title="Cost Per Mile Forecast"
              historical={cpmForecast.historical}
              projected={cpmForecast.projected}
              confidence={cpmForecast.confidence}
              format="currency"
            />
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-foreground">Cost Per Mile Forecast</p>
              <div className="flex h-[200px] items-center justify-center">
                <p className="text-xs text-muted-foreground text-center">
                  Add distance miles to orders to enable cost-per-mile forecasting
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Break-Even Analysis */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakEvenCard revenueData={revenueData} costData={costData} />

        {/* Forecast methodology note */}
        <div className="widget-card flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Forecast Methodology
          </p>
          <p className="text-sm text-foreground font-medium">Linear regression (OLS)</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Projections use ordinary least-squares regression on historical monthly data.
            Confidence bands represent ±1 standard error of the regression residuals.
            Forecasts assume no structural breaks in operations, seasonality, or pricing.
          </p>
          <div className="border-t border-border-subtle pt-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Historical months used</span>
              <span className="font-medium text-foreground tabular-nums">{kpiTrend.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Periods projected</span>
              <span className="font-medium text-foreground tabular-nums">3</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Revenue avg growth</span>
              <span
                className={cn(
                  'font-medium tabular-nums',
                  revenueForecast.avgGrowthRate >= 0 ? 'text-emerald-600' : 'text-rose-500'
                )}
              >
                {revenueForecast.avgGrowthRate >= 0 ? '+' : ''}
                {revenueForecast.avgGrowthRate.toFixed(1)}% / mo
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
