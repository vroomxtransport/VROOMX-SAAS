'use client'

import { useMemo } from 'react'
import { DollarSign, Building2, Truck } from 'lucide-react'
import type { BusinessExpense } from '@/types/database'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

interface Props {
  expenses: BusinessExpense[]
  truckCount: number
}

export function BusinessExpenseSummaryCards({ expenses, truckCount }: Props) {
  const summary = useMemo(() => {
    let totalMonthly = 0
    let totalOneTime = 0

    for (const e of expenses) {
      const amount = parseFloat(e.amount || '0')
      switch (e.recurrence) {
        case 'monthly':
          totalMonthly += amount
          break
        case 'quarterly':
          totalMonthly += amount / 3
          break
        case 'annual':
          totalMonthly += amount / 12
          break
        case 'one_time':
          totalOneTime += amount
          break
      }
    }

    const costPerTruck = truckCount > 0 ? totalMonthly / truckCount : 0

    return { totalMonthly, totalOneTime, costPerTruck }
  }, [expenses, truckCount])

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SummaryCard
        label="Monthly Fixed Costs"
        value={formatCurrency(summary.totalMonthly)}
        subtitle="Prorated from all recurring"
        icon={<DollarSign className="h-4 w-4 text-amber-600" />}
      />
      <SummaryCard
        label="One-Time Expenses"
        value={formatCurrency(summary.totalOneTime)}
        subtitle="Total one-time costs"
        icon={<Building2 className="h-4 w-4 text-blue-600" />}
      />
      <SummaryCard
        label="Fixed Cost / Truck"
        value={formatCurrency(summary.costPerTruck)}
        subtitle={`${truckCount} active truck${truckCount !== 1 ? 's' : ''}`}
        icon={<Truck className="h-4 w-4 text-green-600" />}
      />
    </div>
  )
}

function SummaryCard({ label, value, subtitle, icon }: {
  label: string
  value: string
  subtitle: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}
