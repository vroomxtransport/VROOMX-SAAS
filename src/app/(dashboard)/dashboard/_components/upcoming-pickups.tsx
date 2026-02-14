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

export function UpcomingPickups({ pickups }: UpcomingPickupsProps) {
  // Group pickups by date label
  const grouped: Record<string, Pickup[]> = {}
  for (const p of pickups) {
    const label = getDateLabel(p.pickupDate)
    if (!grouped[label]) grouped[label] = []
    grouped[label].push(p)
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">Upcoming Pickups</h3>
        <Link href="/orders?status=assigned" className="text-sm text-brand hover:underline">
          View All
        </Link>
      </div>

      {pickups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No upcoming pickups scheduled.</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {dateLabel}
              </p>
              <div className="space-y-2">
                {items.map((pickup) => (
                  <div
                    key={pickup.orderNumber}
                    className="flex items-start gap-3 rounded-lg p-2 hover:bg-accent/50 transition-colors"
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-2.5 w-2.5 rounded-full shrink-0',
                        pickup.driverName ? 'bg-green-500' : 'bg-amber-500'
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
