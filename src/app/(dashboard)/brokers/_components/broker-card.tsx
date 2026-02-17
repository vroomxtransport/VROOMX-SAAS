'use client'

import { EntityCard } from '@/components/shared/entity-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Mail, Phone, Building2 } from 'lucide-react'
import type { Broker } from '@/types/database'
import { PAYMENT_TERMS_LABELS } from '@/types'

interface BrokerCardProps {
  broker: Broker
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
}

export function BrokerCard({ broker, onClick, onEdit }: BrokerCardProps) {
  return (
    <EntityCard onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">
            {broker.name}
          </h3>

          <div className="mt-1.5 space-y-1.5">
            {broker.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{broker.email}</span>
              </div>
            )}
            {broker.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{broker.phone}</span>
              </div>
            )}
            {broker.factoring_company && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{broker.factoring_company}</span>
              </div>
            )}
          </div>

          {broker.payment_terms && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                {PAYMENT_TERMS_LABELS[broker.payment_terms]}
              </Badge>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground/60 hover:text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(e)
          }}
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit {broker.name}</span>
        </Button>
      </div>
    </EntityCard>
  )
}
