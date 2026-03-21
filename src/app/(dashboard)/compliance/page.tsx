import { Suspense } from 'react'
import { ComplianceOverview } from './_components/compliance-overview'

function OverviewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted/40" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-64 rounded-xl bg-muted/40" />
          <div className="h-64 rounded-xl bg-muted/40" />
        </div>
        <div className="space-y-4">
          <div className="h-64 rounded-xl bg-muted/40" />
          <div className="h-64 rounded-xl bg-muted/40" />
        </div>
      </div>
    </div>
  )
}

export default function CompliancePage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <ComplianceOverview />
    </Suspense>
  )
}
