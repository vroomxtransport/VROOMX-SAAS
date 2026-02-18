'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import type { PnLOutput } from '@/lib/financial/pnl-calculations'

function fmt(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`
  }
  return `$${value.toFixed(0)}`
}

interface Props {
  pnl: PnLOutput
}

export function RevenueWaterfallChart({ pnl }: Props) {
  const data = useMemo(() => {
    return [
      { name: 'Revenue', value: pnl.revenue, fill: '#22c55e' },
      { name: 'Broker', value: -pnl.brokerFees, fill: '#f97316' },
      { name: 'Local', value: -pnl.localFees, fill: '#f59e0b' },
      { name: 'Clean Gross', value: pnl.cleanGross, fill: '#3b82f6' },
      { name: 'Driver', value: -pnl.driverPay, fill: '#8b5cf6' },
      { name: 'Truck Gross', value: pnl.truckGross, fill: '#6366f1' },
      { name: 'Fixed', value: -pnl.fixedCosts, fill: '#ef4444' },
      { name: 'Trip Costs', value: -pnl.directTripCosts, fill: '#ec4899' },
      { name: 'Net Profit', value: pnl.netProfitBeforeTax, fill: pnl.netProfitBeforeTax >= 0 ? '#10b981' : '#ef4444' },
    ].filter((d) => d.value !== 0)
  }, [pnl])

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Revenue Waterfall</h3>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #e5e7eb)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#7a7a7a' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#7a7a7a' }}
            tickFormatter={fmt}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number | undefined) => [
              new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value ?? 0),
              '',
            ]}
            contentStyle={{
              backgroundColor: 'var(--surface, #fff)',
              border: '1px solid var(--border-subtle, #e5e7eb)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <ReferenceLine y={0} stroke="#d1d5db" />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
