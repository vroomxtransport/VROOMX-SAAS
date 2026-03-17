'use client'

import { useState, useCallback, useMemo } from 'react'
import { useDispatchers } from '@/hooks/use-dispatchers'
import { DispatcherCard } from './dispatcher-card'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Users } from 'lucide-react'
import type { EnhancedFilterConfig, DateRange } from '@/types/filters'

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'dispatcher', label: 'Dispatcher' },
]

const FILTER_CONFIG: EnhancedFilterConfig[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Dispatcher name...',
  },
  {
    key: 'role',
    label: 'Role',
    type: 'select',
    options: ROLE_OPTIONS,
  },
]

export function DispatcherList() {
  const { data: dispatchers, isLoading } = useDispatchers()

  const [search, setSearch] = useState<string | undefined>(undefined)
  const [role, setRole] = useState<string | undefined>(undefined)

  const activeFilters = useMemo(() => {
    const filters: Record<string, string | string[] | DateRange | undefined> = {}
    if (search) filters.search = search
    if (role) filters.role = role
    return filters
  }, [search, role])

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      if (key === 'search') {
        setSearch(value as string | undefined)
      } else if (key === 'role') {
        setRole(value as string | undefined)
      }
    },
    []
  )

  const filtered = useMemo(() => {
    if (!dispatchers) return []
    let result = [...dispatchers]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (d) =>
          d.full_name.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q)
      )
    }

    if (role) {
      result = result.filter((d) => d.role === role)
    }

    return result
  }, [dispatchers, search, role])

  const handleCsvExport = useCallback(async () => {
    return filtered.map((d) => ({
      full_name: d.full_name || d.user_id.substring(0, 8),
      email: d.email,
      role: d.role,
      created_at: new Date(d.created_at).toLocaleDateString('en-US'),
    }))
  }, [filtered])

  if (isLoading) {
    return (
      <div>
        <div className="mb-4">
          <Skeleton className="h-9 w-[300px]" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
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
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <EnhancedFilterBar
            filters={FILTER_CONFIG}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            resultCount={filtered.length}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CsvExportButton
            filename="dispatchers"
            headers={['full_name', 'email', 'role', 'created_at']}
            fetchData={handleCsvExport}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No matching dispatchers"
          description="Try adjusting your search or filters."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((dispatcher) => (
            <DispatcherCard key={dispatcher.id} dispatcher={dispatcher} />
          ))}
        </div>
      )}
    </div>
  )
}
