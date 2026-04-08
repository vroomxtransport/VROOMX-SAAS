import { Suspense } from 'react'
import { ApplicationDetail } from './_components/application-detail'

interface Props {
  params: Promise<{ applicationId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { applicationId } = await params
  return {
    title: `Application ${applicationId.slice(0, 8).toUpperCase()} | VroomX Onboarding`,
  }
}

export default async function ApplicationDetailPage({ params }: Props) {
  const { applicationId } = await params

  return (
    <Suspense fallback={<ApplicationDetailSkeleton />}>
      <ApplicationDetail applicationId={applicationId} />
    </Suspense>
  )
}

function ApplicationDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded bg-muted/40" />
      <div className="h-12 rounded-xl bg-muted/40" />
      <div className="h-96 rounded-xl bg-muted/40" />
    </div>
  )
}
