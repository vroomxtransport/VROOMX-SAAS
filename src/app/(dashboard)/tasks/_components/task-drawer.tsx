'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { TaskForm } from './task-form'
import { useQueryClient } from '@tanstack/react-query'
import type { Task } from '@/types/database'

interface TaskDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task
}

export function TaskDrawer({ open, onOpenChange, task }: TaskDrawerProps) {
  const isEdit = !!task
  const queryClient = useQueryClient()

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['task-counts'] })
    if (isEdit && task) {
      queryClient.invalidateQueries({ queryKey: ['task', task.id] })
    }
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Task' : 'Add Task'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? `Update "${task.title}" details and assignment.`
              : 'Create a new task for your team.'}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <TaskForm
            task={task}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
