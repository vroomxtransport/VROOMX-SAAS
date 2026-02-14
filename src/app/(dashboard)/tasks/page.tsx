import { Suspense } from 'react'
import { TaskList } from './_components/task-list'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = {
  title: 'Tasks | VroomX',
}

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        subtitle="Manage team tasks, assignments, and deadlines"
      />
      <Suspense fallback={null}>
        <TaskList />
      </Suspense>
    </div>
  )
}
