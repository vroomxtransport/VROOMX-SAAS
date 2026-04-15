'use client'

import type { PnLOutput } from '@/lib/financial/pnl-calculations'
import { BUSINESS_EXPENSE_CATEGORY_LABELS } from '@/types'
import type { BusinessExpenseCategory } from '@/types'
import { cn } from '@/lib/utils'

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`
}

interface Props {
  pnl: PnLOutput
}

export function PnLStatement({ pnl }: Props) {
  const fixedCategories = Object.entries(pnl.fixedCostsByCategory)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="widget-card-primary">
      <div className="widget-header">
        <div className="widget-title">
          <div className="widget-accent-dot" />
          Profit &amp; Loss Statement
        </div>
      </div>

      <div className="mt-4 space-y-1 text-sm">
        {/* Revenue Section */}
        <SectionHeader label="Revenue" accentColor="bg-blue-500" />
        <LineItem label="Load Revenue" value={pnl.revenue} bold />
        <LineItem label="Less: Broker Fees" value={-pnl.brokerFees} indent />
        <LineItem label="Less: Local Fees" value={-pnl.localFees} indent />
        <SubtotalRow label="Clean Gross" value={pnl.cleanGross} />
        <LineItem label="Less: Driver Pay" value={-pnl.driverPay} indent />
        <SubtotalRow label="Truck Gross" value={pnl.truckGross} />
        <LineItem
          label="Gross Profit Margin"
          valueStr={pct(pnl.grossProfitMargin)}
          muted
        />

        {/* Operating Expenses Section */}
        <div className="pt-3">
          <SectionHeader label="Operating Expenses" accentColor="bg-amber-500" />
        </div>

        {/* Fixed Costs */}
        {fixedCategories.length > 0 && (
          <>
            {fixedCategories.map(([cat, amount]) => (
              <LineItem
                key={cat}
                label={BUSINESS_EXPENSE_CATEGORY_LABELS[cat as BusinessExpenseCategory] ?? cat}
                value={amount}
                indent
                             />
            ))}
            <SubtotalRow label="Total Fixed Costs" value={pnl.fixedCosts} />
          </>
        )}

        {/* Direct Trip Costs */}
        {pnl.directTripCosts > 0 && (
          <>
            {pnl.fuelCosts > 0 && <LineItem label="Fuel" value={pnl.fuelCosts} indent section="expense" />}
            {pnl.tollCosts > 0 && <LineItem label="Tolls" value={pnl.tollCosts} indent section="expense" />}
            {pnl.maintenanceCosts > 0 && <LineItem label="Maintenance" value={pnl.maintenanceCosts} indent section="expense" />}
            {pnl.lodgingCosts > 0 && <LineItem label="Lodging" value={pnl.lodgingCosts} indent section="expense" />}
            {pnl.miscCosts > 0 && <LineItem label="Miscellaneous" value={pnl.miscCosts} indent section="expense" />}
            <SubtotalRow label="Total Direct Trip Costs" value={pnl.directTripCosts} />
          </>
        )}

        {pnl.carrierPay > 0 && (
          <LineItem label="Carrier Pay" value={pnl.carrierPay} section="expense" />
        )}

        <SubtotalRow label="Total Operating Expenses" value={pnl.totalOperatingExpenses} />

        {/* Net Profit Banner */}
        <div className={cn(
          'flex items-center justify-between rounded-xl p-4 mt-4',
          pnl.netProfitBeforeTax >= 0
            ? 'border border-emerald-200 text-emerald-800'
            : 'border border-red-200 text-red-800'
        )}>
          <span className="font-bold">NET PROFIT BEFORE TAX</span>
          <span className="font-bold tabular-nums text-lg">
            {fmt(pnl.netProfitBeforeTax)}
          </span>
        </div>

        <LineItem
          label="Net Margin"
          valueStr={pct(pnl.netMargin)}
          muted
        />

        {pnl.breakEvenRevenue !== null && (
          <LineItem
            label="Break-Even Revenue"
            valueStr={fmt(pnl.breakEvenRevenue)}
            muted
          />
        )}
      </div>
    </div>
  )
}

function SectionHeader({ label, accentColor }: { label: string; accentColor: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 pt-2">
      <div className={cn('h-1 w-6 rounded-full', accentColor)} />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

function SubtotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/50 -mx-4 px-4 py-2 rounded-lg font-semibold flex items-center justify-between">
      <span className="text-foreground">{label}</span>
      <span className={cn(
        'tabular-nums text-foreground',
        value < 0 && 'text-red-600',
      )}>
        {fmt(value)}
      </span>
    </div>
  )
}

function LineItem({ label, value, valueStr, bold, indent, muted }: {
  label: string
  value?: number
  valueStr?: string
  bold?: boolean
  indent?: boolean
  muted?: boolean
  section?: string
}) {
  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-1.5',
      indent && 'border-l-2 border-border ml-2',
    )}>
      <span className={cn(
        indent && 'pl-3',
        !indent && bold ? 'font-semibold text-foreground' : '',
        !bold && !muted && 'text-muted-foreground',
        muted && 'text-xs italic text-muted-foreground',
      )}>
        {label}
      </span>
      <span className={cn(
        'tabular-nums',
        bold ? 'font-semibold text-foreground' : 'text-muted-foreground',
        muted && 'text-xs',
        value !== undefined && value < 0 && 'text-red-600',
      )}>
        {valueStr ?? (value !== undefined ? fmt(value) : '')}
      </span>
    </div>
  )
}
