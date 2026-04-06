'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Pencil, Phone, Mail } from 'lucide-react'
import { CopyIdButton } from '@/components/shared/copy-id-button'
import { DRIVER_TYPE_LABELS } from '@/types'
import { updateDriverStatus } from '@/app/actions/drivers'
import type { Driver } from '@/types/database'
import type { DriverType, DriverPayType } from '@/types'

interface DriverRowProps {
  driver: Driver
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
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

export function DriverRow({ driver, onClick, onEdit }: DriverRowProps) {
  const fullName = `${driver.first_name} ${driver.last_name}`
  const payRate = parseFloat(driver.pay_rate)
  const queryClient = useQueryClient()
  const [isPending, setIsPending] = useState(false)

  const handleToggle = async (checked: boolean) => {
    if (isPending) return
    setIsPending(true)
    try {
      const newStatus = checked ? 'active' : 'inactive'
      await updateDriverStatus(driver.id, newStatus)
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
    } finally {
      setIsPending(false)
    }
  }

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
      className="flex w-full items-center gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-left shadow-sm transition-colors card-hover hover:border-brand/30 focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
    >
      <div className="group/name min-w-0 flex-1 flex items-center gap-1">
        <span className="text-sm font-semibold text-foreground">{fullName}</span>
        <CopyIdButton value={fullName} className="opacity-0 group-hover/name:opacity-100 transition-opacity" />
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <StatusBadge status={driver.driver_status} type="driver" />
        <Badge variant="outline" className="text-xs">
          {DRIVER_TYPE_LABELS[driver.driver_type as DriverType]}
        </Badge>
      </div>

      <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
        {driver.phone && (
          <span className="group/phone flex items-center gap-1">
            <Phone className="h-3 w-3 shrink-0" />
            {driver.phone}
            <CopyIdButton value={driver.phone} className="opacity-0 group-hover/phone:opacity-100 transition-opacity" />
          </span>
        )}
        {driver.email && (
          <span className="group/email flex items-center gap-1">
            <Mail className="h-3 w-3 shrink-0" />
            {driver.email}
            <CopyIdButton value={driver.email} className="opacity-0 group-hover/email:opacity-100 transition-opacity" />
          </span>
        )}
      </div>

      <div className="hidden lg:block text-xs font-medium text-foreground/80 shrink-0 w-[160px]">
        {formatPayInfo(driver.pay_type as DriverPayType, payRate)}
      </div>

      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <Switch
          size="sm"
          checked={driver.driver_status === 'active'}
          onCheckedChange={handleToggle}
          disabled={isPending}
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
