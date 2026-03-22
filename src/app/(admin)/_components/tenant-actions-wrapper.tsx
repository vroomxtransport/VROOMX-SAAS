'use client'

import { useRouter } from 'next/navigation'
import { TenantActions } from './tenant-actions'

interface TenantActionsWrapperProps {
  tenantId: string
  tenantName: string
  isSuspended: boolean
}

export function TenantActionsWrapper({
  tenantId,
  tenantName,
  isSuspended,
}: TenantActionsWrapperProps) {
  const router = useRouter()

  return (
    <TenantActions
      tenantId={tenantId}
      tenantName={tenantName}
      isSuspended={isSuspended}
      onActionComplete={() => router.refresh()}
    />
  )
}
