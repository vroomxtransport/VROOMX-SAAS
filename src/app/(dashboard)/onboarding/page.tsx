import { Suspense } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { ApplicationsList } from './_components/applications-list'
import { InviteDriverButton } from './_components/invite-driver-button'

export const metadata = {
  title: 'Onboarding | VroomX',
}

export default function OnboardingPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Driver Onboarding"
        subtitle="Review and process driver applications through the FMCSA compliance pipeline"
      >
        <InviteDriverButton />
      </PageHeader>
      <Suspense fallback={null}>
        <ApplicationsList />
      </Suspense>
    </div>
  )
}
