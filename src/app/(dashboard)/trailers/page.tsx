import { Suspense } from 'react'
import { TrailerList } from './_components/trailer-list'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = {
  title: 'Trailers | VroomX',
}

export default function TrailersPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Trailers"
        subtitle="Manage your trailers and assign them to trucks"
      />
      <Suspense fallback={null}>
        <TrailerList />
      </Suspense>
    </div>
  )
}
