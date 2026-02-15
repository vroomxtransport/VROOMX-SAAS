'use client'

import { EntityCard } from '@/components/shared/entity-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Pencil, Phone, Mail } from 'lucide-react'
import { DRIVER_TYPE_LABELS, DRIVER_PAY_TYPE_LABELS } from '@/types'
import type { Driver } from '@/types/database'
import type { DriverType, DriverPayType } from '@/types'

interface DriverCardProps {
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
      return `Per mile: $${payRate.toFixed(2)}/mi`
    default:
      return `${payRate}`
  }
}

export function DriverCard({ driver, onClick, onEdit, onStatusToggle }: DriverCardProps) {
  const fullName = `${driver.first_name} ${driver.last_name}`
  const payRate = typeof driver.pay_rate === 'string' ? parseFloat(driver.pay_rate) : driver.pay_rate

  return (
    <EntityCard onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900">{fullName}</h3>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={driver.driver_status} type="driver" />
            <Badge variant="outline" className="text-xs">
              {DRIVER_TYPE_LABELS[driver.driver_type as DriverType]}
            </Badge>
          </div>
        </div>
        <div className="ml-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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

      <div className="mt-2 space-y-1">
        {driver.phone && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Phone className="h-3 w-3" />
            <span>{driver.phone}</span>
          </div>
        )}
        {driver.email && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Mail className="h-3 w-3" />
            <span className="truncate">{driver.email}</span>
          </div>
        )}
      </div>

      <div className="mt-2 border-t border-gray-100 pt-1.5">
        <p className="text-xs font-medium text-gray-600">
          Pay: {formatPayInfo(driver.pay_type as DriverPayType, payRate)}
        </p>
      </div>
    </EntityCard>
  )
}
