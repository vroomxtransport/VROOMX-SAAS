'use client'

import { EntityCard } from '@/components/shared/entity-card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Pencil, Calendar, User } from 'lucide-react'
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS, TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '@/types'
import type { Task } from '@/types/database'
import type { TaskPriority, TaskStatus } from '@/types'
import { cn } from '@/lib/utils'

interface TaskCardProps {
  task: Task
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
  onToggleComplete: (completed: boolean) => void
}

function formatDueDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isDueOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const today = new Date().toISOString().split('T')[0]
  return dateStr < today
}

export function TaskCard({ task, onClick, onEdit, onToggleComplete }: TaskCardProps) {
  const isCompleted = task.status === 'completed'
  const dueLabel = formatDueDate(task.due_date)
  const overdue = !isCompleted && isDueOverdue(task.due_date)

  return (
    <EntityCard onClick={onClick}>
      <div className="flex items-start gap-3">
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isCompleted}
            onCheckedChange={(checked) => onToggleComplete(!!checked)}
            aria-label="Toggle task complete"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <h3
              className={cn(
                'text-sm font-semibold text-foreground',
                isCompleted && 'line-through text-muted-foreground'
              )}
            >
              {task.title}
            </h3>
            <div className="ml-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn('text-xs', TASK_PRIORITY_COLORS[task.priority as TaskPriority])}
            >
              {TASK_PRIORITY_LABELS[task.priority as TaskPriority]}
            </Badge>
            <Badge
              variant="outline"
              className={cn('text-xs', TASK_STATUS_COLORS[task.status as TaskStatus])}
            >
              {TASK_STATUS_LABELS[task.status as TaskStatus]}
            </Badge>
            {task.category && (
              <Badge variant="outline" className="text-xs">
                {task.category}
              </Badge>
            )}
          </div>

          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {dueLabel && (
              <div className={cn('flex items-center gap-1', overdue && 'text-red-600 font-medium')}>
                <Calendar className="h-3 w-3" />
                <span>{dueLabel}</span>
                {overdue && <span>(overdue)</span>}
              </div>
            )}
            {task.assigned_name && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{task.assigned_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </EntityCard>
  )
}
