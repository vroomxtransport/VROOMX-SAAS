'use client'

import { useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTasks } from '@/hooks/use-tasks'
import { toggleTaskStatus } from '@/app/actions/tasks'
import { TaskCard } from './task-card'
import { TaskDrawer } from './task-drawer'
import { TaskStats } from './task-stats'
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, ClipboardList } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import type { Task } from '@/types/database'

const PAGE_SIZE = 12

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Search tasks...',
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'urgent', label: 'Urgent' },
    ],
  },
]

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
] as const

export function TaskList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  // Parse filters from URL
  const currentPage = parseInt(searchParams.get('page') ?? '0', 10)
  const currentTab = searchParams.get('tab') ?? 'all'
  const activeFilters: Record<string, string> = {}
  for (const filter of FILTER_CONFIG) {
    const value = searchParams.get(filter.key)
    if (value) {
      activeFilters[filter.key] = value
    }
  }

  const { data, isLoading } = useTasks({
    priority: activeFilters.priority,
    search: activeFilters.search,
    tab: currentTab === 'all' ? undefined : currentTab,
    page: currentPage,
    pageSize: PAGE_SIZE,
  })

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined)

  const handleFilterChange = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page')
      router.push(`/tasks?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handleTabChange = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'all') {
        params.delete('tab')
      } else {
        params.set('tab', tab)
      }
      params.delete('page')
      router.push(`/tasks?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (page === 0) {
        params.delete('page')
      } else {
        params.set('page', String(page))
      }
      router.push(`/tasks?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handleAddTask = () => {
    setEditingTask(undefined)
    setDrawerOpen(true)
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setDrawerOpen(true)
  }

  const handleToggleComplete = async (task: Task, completed: boolean) => {
    const newStatus = completed ? 'completed' : 'pending'
    await toggleTaskStatus(task.id, newStatus)
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['task-counts'] })
  }

  if (isLoading) {
    return (
      <div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </div>
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-9 w-[200px]" />
          <Skeleton className="h-9 w-[120px]" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  const tasks = data?.tasks ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <TaskStats />

      {/* Tabs */}
      <div className="mt-6 mb-4 flex items-center gap-1 rounded-lg border border-border-subtle bg-surface p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              currentTab === tab.key
                ? 'bg-brand text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          filters={FILTER_CONFIG}
          onFilterChange={handleFilterChange}
          activeFilters={activeFilters}
        />
        <Button onClick={handleAddTask}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tasks yet"
          description="Create your first task to start tracking team work and deadlines."
          action={{
            label: 'Add Task',
            onClick: handleAddTask,
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => handleEditTask(task)}
                onEdit={(e) => {
                  e.stopPropagation()
                  handleEditTask(task)
                }}
                onToggleComplete={(checked) => handleToggleComplete(task, checked)}
              />
            ))}
          </div>

          <div className="mt-6">
            <Pagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={handlePageChange}
            />
          </div>
        </>
      )}

      <TaskDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        task={editingTask}
      />
    </div>
  )
}
