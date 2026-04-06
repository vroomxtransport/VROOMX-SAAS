export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { TenantList } from '@/app/(admin)/_components/tenant-list'

export const metadata = {
  title: 'Tenants — VroomX Admin',
}

// TenantList reads URL searchParams via useSearchParams(), which requires Suspense
export default function AdminTenantsPage() {
  return (
    <Suspense>
      <TenantList />
    </Suspense>
  )
}
