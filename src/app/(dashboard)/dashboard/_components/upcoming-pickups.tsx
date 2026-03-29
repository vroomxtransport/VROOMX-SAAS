import Link from 'next/link'
import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'

interface Pickup {
  orderNumber: string
  vehicle: string
  location: string
  driverName: string | null
  pickupDate: string // ISO date string
}

interface UpcomingPickupsProps {
  pickups: Pickup[]
}

function getDateLabel(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const date = new Date(dateStr)
  date.setHours(0, 0, 0, 0)

  if (date.getTime() === today.getTime()) return 'Today'
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function getDatePillClass(dateLabel: string): string {
  if (dateLabel === 'Today') {
    return 'bg-brand/10 text-brand'
  }
  if (dateLabel === 'Tomorrow') {
    return 'bg-amber-100 text-amber-700'
  }
  return 'bg-muted text-muted-foreground'
}

export function UpcomingPickups({ pickups }: UpcomingPickupsProps) {
  // Group pickups by date label
  const grouped: Record<string, Pickup[]> = {}
  for (const p of pickups) {
    const label = getDateLabel(p.pickupDate)
    if (!grouped[label]) grouped[label] = []
    grouped[label].push(p)
  }

  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-amber-500" />
          Upcoming Pickups
        </span>
        <Link href="/orders?status=assigned" className="text-sm text-brand hover:underline">
          View All
        </Link>
      </div>

      {pickups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No upcoming pickups scheduled.</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden space-y-3">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <span
                className={cn(
                  'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider mb-2',
                  getDatePillClass(dateLabel)
                )}
              >
                {dateLabel}
              </span>
              <div className="space-y-1">
                {items.map((pickup) => (
                  <div
                    key={pickup.orderNumber}
                    className="flex items-start gap-3 rounded-xl border border-transparent p-2.5 transition-all hover:border-border-subtle hover:bg-surface-raised"
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ring-2',
                        pickup.driverName
                          ? 'bg-green-500 ring-green-500/20'
                          : 'bg-amber-500 ring-amber-500/20'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {pickup.vehicle}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{pickup.orderNumber}</span>
                        <span className="text-muted-foreground/40">|</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {pickup.location}
                        </span>
                      </div>
                      {pickup.driverName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Driver: {pickup.driverName}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
