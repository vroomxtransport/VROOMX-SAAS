'use client'

import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Pencil, Phone, Mail } from 'lucide-react'
import { DRIVER_TYPE_LABELS } from '@/types'
import type { Driver } from '@/types/database'
import type { DriverType, DriverPayType } from '@/types'

interface DriverRowProps {
  driver: Driver
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
  onStatusToggle: (checked: boolean) => void
}

function formatPayInfo(payType: DriverPayType, payRate: number): string {
  switch (payType) {
    case 'percentage_of_carrier_pay':
      return `${payRate}% of carrier pay`
    case 'dispatch_fee_percent':
      return `Dispatch fee: ${payRate}%`
    case 'per_mile':
      return `$${payRate.toFixed(2)}/mi`
    default:
      return `${payRate}`
  }
}

export function DriverRow({ driver, onClick, onEdit, onStatusToggle }: DriverRowProps) {
  const fullName = `${driver.first_name} ${driver.last_name}`
  const payRate = typeof driver.pay_rate === 'string' ? parseFloat(driver.pay_rate) : driver.pay_rate

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="flex w-full items-center gap-4 rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-left shadow-sm transition-colors card-hover hover:border-brand/30 focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold text-gray-900">{fullName}</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <StatusBadge status={driver.driver_status} type="driver" />
        <Badge variant="outline" className="text-xs">
          {DRIVER_TYPE_LABELS[driver.driver_type as DriverType]}
        </Badge>
      </div>

      <div className="hidden md:flex items-center gap-4 text-xs text-gray-500 shrink-0 w-[200px]">
        {driver.phone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {driver.phone}
          </span>
        )}
        {driver.email && (
          <span className="flex items-center gap-1 truncate">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{driver.email}</span>
          </span>
        )}
      </div>

      <div className="hidden lg:block text-xs font-medium text-gray-600 shrink-0 w-[160px]">
        {formatPayInfo(driver.pay_type as DriverPayType, payRate)}
      </div>

      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Switch
          size="sm"
          checked={driver.driver_status === 'active'}
          onCheckedChange={onStatusToggle}
          aria-label="Toggle driver status"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
