'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { updateTrip } from '@/app/actions/trips'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DollarSign,
  TrendingUp,
  Building2,
  User,
  Receipt,
  Calculator,
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { DRIVER_PAY_TYPE_LABELS } from '@/types'
import type { TripWithRelations } from '@/lib/queries/trips'
import type { DriverPayType } from '@/types'

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

interface TripFinancialCardProps {
  trip: TripWithRelations
}

interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  accent: string
  large?: boolean
  editAction?: React.ReactNode
}

function StatCard({ label, value, subtitle, icon, accent, large, editAction }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-lg border bg-white p-4',
      large && 'ring-1 ring-gray-200'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('rounded-md p-1.5', accent)}>
            {icon}
          </div>
          <span className="text-xs font-medium uppercase text-gray-500">{label}</span>
        </div>
        {editAction}
      </div>
      <p className={cn(
        'mt-2 font-semibold text-gray-900',
        large ? 'text-xl' : 'text-lg'
      )}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
      )}
    </div>
  )
}

export function TripFinancialCard({ trip }: TripFinancialCardProps) {
  const queryClient = useQueryClient()
  const [isEditingCarrierPay, setIsEditingCarrierPay] = useState(false)
  const [carrierPayValue, setCarrierPayValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const revenue = parseFloat(trip.total_revenue || '0')
  const carrierPay = parseFloat(trip.carrier_pay || '0')
  const brokerFees = parseFloat(trip.total_broker_fees || '0')
  const driverPay = parseFloat(trip.driver_pay || '0')
  const expenses = parseFloat(trip.total_expenses || '0')
  const netProfit = parseFloat(trip.net_profit || '0')

  const payType = trip.driver?.pay_type as DriverPayType | undefined
  const payRate = trip.driver?.pay_rate

  // Build driver pay subtitle showing the pay model
  let driverPaySubtitle = ''
  if (payType && payRate !== undefined && payRate !== null) {
    if (payType === 'per_car') {
      driverPaySubtitle = `$${payRate}/car`
    } else if (payType === 'percentage_of_carrier_pay') {
      driverPaySubtitle = `${payRate}% of carrier pay`
    } else if (payType === 'dispatch_fee_percent') {
      driverPaySubtitle = `${payRate}% dispatch fee`
    } else if (payType === 'per_mile') {
      driverPaySubtitle = `$${payRate}/mile`
    } else {
      driverPaySubtitle = DRIVER_PAY_TYPE_LABELS[payType]
    }
  }

  const handleStartEdit = useCallback(() => {
    setCarrierPayValue(String(carrierPay))
    setIsEditingCarrierPay(true)
  }, [carrierPay])

  const handleCancelEdit = useCallback(() => {
    setIsEditingCarrierPay(false)
    setCarrierPayValue('')
  }, [])

  const handleSaveCarrierPay = useCallback(async () => {
    const numValue = parseFloat(carrierPayValue)
    if (isNaN(numValue) || numValue < 0) return

    setIsSaving(true)
    try {
      const result = await updateTrip(trip.id, { carrier_pay: numValue })
      if ('error' in result && result.error) {
        console.error('Failed to update carrier pay:', result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['trip', trip.id] })
      setIsEditingCarrierPay(false)
    } finally {
      setIsSaving(false)
    }
  }, [trip.id, carrierPayValue, queryClient])

  const carrierPayEditAction = isEditingCarrierPay ? (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step="0.01"
        min="0"
        value={carrierPayValue}
        onChange={(e) => setCarrierPayValue(e.target.value)}
        className="h-7 w-24 text-sm"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSaveCarrierPay()
          if (e.key === 'Escape') handleCancelEdit()
        }}
        autoFocus
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={handleSaveCarrierPay}
        disabled={isSaving}
      >
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5 text-green-600" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={handleCancelEdit}
        disabled={isSaving}
      >
        <X className="h-3.5 w-3.5 text-gray-400" />
      </Button>
    </div>
  ) : (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={handleStartEdit}
    >
      <Pencil className="h-3.5 w-3.5 text-gray-400" />
    </Button>
  )

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {/* 1. Revenue */}
      <StatCard
        label="Revenue"
        value={formatCurrency(revenue)}
        subtitle={`${trip.order_count} order${trip.order_count !== 1 ? 's' : ''}`}
        icon={<DollarSign className="h-4 w-4 text-green-600" />}
        accent="bg-green-50"
      />

      {/* 2. Carrier Pay */}
      <StatCard
        label="Carrier Pay"
        value={isEditingCarrierPay ? '' : formatCurrency(carrierPay)}
        icon={<Building2 className="h-4 w-4 text-gray-600" />}
        accent="bg-gray-100"
        editAction={carrierPayEditAction}
      />

      {/* 3. Broker Fees */}
      <StatCard
        label="Broker Fees"
        value={formatCurrency(brokerFees)}
        subtitle="Per-order sum"
        icon={<TrendingUp className="h-4 w-4 text-amber-600" />}
        accent="bg-amber-50"
      />

      {/* 4. Driver Pay */}
      <StatCard
        label="Driver Pay"
        value={formatCurrency(driverPay)}
        subtitle={driverPaySubtitle}
        icon={<User className="h-4 w-4 text-blue-600" />}
        accent="bg-blue-50"
      />

      {/* 5. Expenses */}
      <StatCard
        label="Expenses"
        value={formatCurrency(expenses)}
        icon={<Receipt className="h-4 w-4 text-red-600" />}
        accent="bg-red-50"
      />

      {/* 6. Net Profit */}
      <div className={cn(
        'rounded-lg border p-4 ring-1',
        netProfit >= 0
          ? 'border-green-200 bg-green-50/50 ring-green-200'
          : 'border-red-200 bg-red-50/50 ring-red-200'
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            'rounded-md p-1.5',
            netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'
          )}>
            <Calculator className={cn(
              'h-4 w-4',
              netProfit >= 0 ? 'text-green-600' : 'text-red-600'
            )} />
          </div>
          <span className="text-xs font-medium uppercase text-gray-500">Net Profit</span>
        </div>
        <p className={cn(
          'mt-2 text-xl font-bold',
          netProfit >= 0 ? 'text-green-700' : 'text-red-700'
        )}>
          {formatCurrency(netProfit)}
        </p>
      </div>
    </div>
  )
}
