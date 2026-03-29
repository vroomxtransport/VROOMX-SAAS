'use client'

import { EntityCard } from '@/components/shared/entity-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserCircle, Mail, Calendar, Banknote } from 'lucide-react'
import { DISPATCHER_PAY_TYPE_LABELS, PAY_FREQUENCY_LABELS } from '@/types'
import type { DispatcherPayType, PayFrequency } from '@/types'
import type { DispatcherPayConfig } from '@/types/database'

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  admin: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  dispatcher: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
}

interface DispatcherCardProps {
  dispatcher: {
    id: string
    user_id: string
    role: string
    email: string
    full_name: string
    created_at: string
  }
  payConfig?: DispatcherPayConfig | null
  onConfigurePay?: () => void
}

export function DispatcherCard({ dispatcher, payConfig, onConfigurePay }: DispatcherCardProps) {
  const displayName = dispatcher.full_name || dispatcher.user_id.substring(0, 8)
  const roleColor = ROLE_COLORS[dispatcher.role] ?? 'bg-gray-500/10 text-gray-500 border-gray-500/20'
  const joinDate = new Date(dispatcher.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <EntityCard>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent">
          <UserCircle className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{displayName}</h3>
            <Badge variant="outline" className={roleColor}>
              {dispatcher.role}
            </Badge>
          </div>

          {dispatcher.email && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate">{dispatcher.email}</span>
            </div>
          )}

          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Member since {joinDate}</span>
          </div>

          {/* Pay Config Badge */}
          {payConfig ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-6 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onConfigurePay?.()
              }}
            >
              <Banknote className="mr-1 h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600 font-medium">
                {DISPATCHER_PAY_TYPE_LABELS[payConfig.pay_type as DispatcherPayType]}
                {' — '}
                {payConfig.pay_type === 'performance_revenue'
                  ? `${parseFloat(payConfig.pay_rate)}%`
                  : `$${parseFloat(payConfig.pay_rate).toLocaleString()}`
                }
                {' / '}
                {PAY_FREQUENCY_LABELS[payConfig.pay_frequency as PayFrequency]}
              </span>
            </Button>
          ) : onConfigurePay ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onConfigurePay()
              }}
            >
              <Banknote className="mr-1 h-3 w-3" />
              Set up pay
            </Button>
          ) : null}
        </div>
      </div>
    </EntityCard>
  )
}
