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
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Operational Statement</h3>
      </div>

      <div className="divide-y divide-border text-sm">
        {/* Revenue Section */}
        <LineItem label="Load Revenue" value={pnl.revenue} bold />
        <LineItem label="Less: Broker Fees" value={-pnl.brokerFees} indent />
        <LineItem label="Less: Local Fees" value={-pnl.localFees} indent />
        <LineItem label="Clean Gross" value={pnl.cleanGross} bold highlight />
        <LineItem label="Less: Driver Pay" value={-pnl.driverPay} indent />
        <LineItem label="Truck Gross" value={pnl.truckGross} bold highlight />
        <LineItem
          label="Gross Profit Margin"
          valueStr={pct(pnl.grossProfitMargin)}
          muted
        />

        {/* Separator */}
        <div className="px-4 py-2 bg-muted/30">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operating Expenses</span>
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
            <LineItem label="Total Fixed Costs" value={pnl.fixedCosts} bold />
          </>
        )}

        {/* Direct Trip Costs */}
        {pnl.directTripCosts > 0 && (
          <>
            {pnl.fuelCosts > 0 && <LineItem label="Fuel" value={pnl.fuelCosts} indent />}
            {pnl.tollCosts > 0 && <LineItem label="Tolls" value={pnl.tollCosts} indent />}
            {pnl.maintenanceCosts > 0 && <LineItem label="Maintenance" value={pnl.maintenanceCosts} indent />}
            {pnl.lodgingCosts > 0 && <LineItem label="Lodging" value={pnl.lodgingCosts} indent />}
            {pnl.miscCosts > 0 && <LineItem label="Miscellaneous" value={pnl.miscCosts} indent />}
            <LineItem label="Total Direct Trip Costs" value={pnl.directTripCosts} bold />
          </>
        )}

        {pnl.carrierPay > 0 && (
          <LineItem label="Carrier Pay" value={pnl.carrierPay} />
        )}

        <LineItem label="Total Operating Expenses" value={pnl.totalOperatingExpenses} bold />

        {/* Bottom Line */}
        <div className={cn(
          'flex items-center justify-between px-4 py-3',
          pnl.netProfitBeforeTax >= 0 ? 'bg-green-50/50 dark:bg-green-950/20' : 'bg-red-50/50 dark:bg-red-950/20'
        )}>
          <span className="font-bold text-foreground">NET PROFIT BEFORE TAX</span>
          <span className={cn(
            'font-bold tabular-nums',
            pnl.netProfitBeforeTax >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
          )}>
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

function LineItem({ label, value, valueStr, bold, indent, highlight, muted }: {
  label: string
  value?: number
  valueStr?: string
  bold?: boolean
  indent?: boolean
  highlight?: boolean
  muted?: boolean
}) {
  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-2',
      highlight && 'bg-muted/30',
    )}>
      <span className={cn(
        indent && 'pl-4',
        bold ? 'font-semibold text-foreground' : 'text-muted-foreground',
        muted && 'text-xs italic',
      )}>
        {label}
      </span>
      <span className={cn(
        'tabular-nums',
        bold ? 'font-semibold text-foreground' : 'text-muted-foreground',
        muted && 'text-xs',
        value !== undefined && value < 0 && 'text-red-600 dark:text-red-400',
      )}>
        {valueStr ?? (value !== undefined ? fmt(value) : '')}
      </span>
    </div>
  )
}
