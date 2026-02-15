'use client'

import { useDispatchers } from '@/hooks/use-dispatchers'
import { DispatcherCard } from './dispatcher-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Users } from 'lucide-react'

export function DispatcherList() {
  const { data: dispatchers, isLoading } = useDispatchers()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-xl" />
        ))}
      </div>
    )
  }

  if (!dispatchers || dispatchers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No dispatchers yet"
        description="Dispatchers will appear here once team members are added with dispatcher, admin, or owner roles."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {dispatchers.map((dispatcher) => (
        <DispatcherCard key={dispatcher.id} dispatcher={dispatcher} />
      ))}
    </div>
  )
}
