'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchDispatcherPerformance } from '@/lib/queries/dispatcher-performance'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { TrendingUp } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  admin: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  dispatcher: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
}

export function PerformanceTable() {
  const supabase = createClient()

  const { data: performers, isLoading } = useQuery({
    queryKey: ['dispatcher-performance'],
    queryFn: () => fetchDispatcherPerformance(supabase),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] rounded-lg" />
        ))}
      </div>
    )
  }

  if (!performers || performers.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No performance data"
        description="Performance metrics will appear once dispatchers are active and orders are assigned."
      />
    )
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-accent/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Orders</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Completed</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {performers.map((p) => {
            const roleColor = ROLE_COLORS[p.role] ?? 'bg-gray-500/10 text-gray-500 border-gray-500/20'

            return (
              <tr key={p.user_id} className="border-b border-border-subtle last:border-0 hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={roleColor}>
                    {p.role}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right text-foreground tabular-nums">{p.total_orders}</td>
                <td className="px-4 py-3 text-right text-foreground tabular-nums">{p.completed_orders}</td>
                <td className="px-4 py-3 text-right text-foreground tabular-nums">
                  ${p.total_revenue.toLocaleString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
