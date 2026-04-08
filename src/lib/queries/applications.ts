/**
 * Query wrappers for the driver onboarding admin pipeline.
 *
 * These are thin wrappers around server actions — the server actions own
 * all auth/validation logic. Query functions only call the action and
 * re-throw on error so TanStack Query can handle the error state.
 */

import { listApplications, getApplicationDetail } from '@/app/actions/driver-applications'
import type { DriverApplication, DriverOnboardingPipeline, DriverOnboardingStep } from '@/types/database'

export interface ApplicationFilters {
  status?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface ApplicationsResult {
  applications: DriverApplication[]
  total: number
}

export interface ApplicationDetailResult {
  application: DriverApplication
  addressHistory: unknown[]
  consents: unknown[]
  documents: unknown[]
  pipeline: (DriverOnboardingPipeline & { steps: DriverOnboardingStep[] }) | null
}

export async function fetchApplications(
  filters: ApplicationFilters = {}
): Promise<ApplicationsResult> {
  const result = await listApplications({
    status: filters.status,
    search: filters.search,
    page: (filters.page ?? 0) + 1, // action uses 1-based pages
    pageSize: filters.pageSize,
  })

  if ('error' in result) {
    throw new Error(result.error)
  }

  return {
    applications: result.applications,
    total: result.total,
  }
}

export async function fetchApplicationDetail(id: string): Promise<ApplicationDetailResult> {
  const result = await getApplicationDetail(id)

  if ('error' in result) {
    throw new Error(result.error)
  }

  return {
    application: result.application,
    addressHistory: result.addressHistory,
    consents: result.consents,
    documents: result.documents,
    pipeline: result.pipeline,
  }
}
