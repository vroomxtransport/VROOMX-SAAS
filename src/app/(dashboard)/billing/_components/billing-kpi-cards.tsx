import { cn } from '@/lib/utils'
import {
  DollarSign,
  Percent,
  FileText,
  CircleCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface BillingKPICardsProps {
  outstandingAR: number
  collectionRate: number
  invoicedMTD: number
  collectedMTD: number
}

interface KPICardDef {
  label: string
  value: string
  icon: LucideIcon
  accent: 'blue' | 'emerald' | 'amber' | 'rose'
}

const ACCENT_STYLES = {
  blue: 'border-blue-200/50 bg-blue-500/5',
  emerald: 'border-emerald-200/50 bg-emerald-500/5',
  amber: 'border-amber-200/50 bg-amber-500/5',
  rose: 'border-rose-200/50 bg-rose-500/5',
}

const ICON_STYLES = {
  blue: 'text-blue-600 bg-blue-100',
  emerald: 'text-emerald-600 bg-emerald-100',
  amber: 'text-amber-600 bg-amber-100',
  rose: 'text-rose-600 bg-rose-100',
}

function fmt$(val: number): string {
  if (Math.abs(val) >= 1000) {
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function BillingKPICards({
  outstandingAR,
  collectionRate,
  invoicedMTD,
  collectedMTD,
}: BillingKPICardsProps) {
  const crAccent: 'emerald' | 'amber' | 'rose' =
    collectionRate >= 80 ? 'emerald' : collectionRate >= 60 ? 'amber' : 'rose'

  const cards: KPICardDef[] = [
    {
      label: 'Outstanding AR',
      value: fmt$(outstandingAR),
      icon: DollarSign,
      accent: outstandingAR > 0 ? 'rose' : 'emerald',
    },
    {
      label: 'Collection Rate',
      value: `${collectionRate.toFixed(1)}%`,
      icon: Percent,
      accent: crAccent,
    },
    {
      label: 'Invoiced MTD',
      value: fmt$(invoicedMTD),
      icon: FileText,
      accent: 'blue',
    },
    {
      label: 'Collected MTD',
      value: fmt$(collectedMTD),
      icon: CircleCheck,
      accent: 'emerald',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            'rounded-xl border p-4 transition-shadow hover:shadow-sm',
            ACCENT_STYLES[card.accent]
          )}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground truncate">
                {card.label}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground truncate">
                {card.value}
              </p>
            </div>
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                ICON_STYLES[card.accent]
              )}
            >
              <card.icon className="h-4 w-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
