'use client'

/**
 * ApplicationWizard — the full 8-page driver application form.
 *
 * Architecture mirrors order-form.tsx:
 * - Single useForm<FullApplicationInput> with zodResolver(fullApplicationSchema)
 * - Per-page safeParse before advancing
 * - Auto-save on page transition via updateDraftSection(resumeToken, 'pageN', data)
 * - Back / Next / Submit buttons at bottom of every page
 */

import { useState, useCallback, useTransition, useRef } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import {
  fullApplicationSchema,
  page1Schema,
  page2Schema,
  page3Schema,
  page4Schema,
  page5Schema,
  page6Schema,
  page7Schema,
  page8Schema,
} from '@/lib/validations/driver-application'
import type { FullApplication } from '@/lib/validations/driver-application'
import {
  updateDraftSection,
  signConsent,
  submitApplication,
} from '@/app/actions/driver-applications'
import { StepIndicator } from './step-indicator'
import { Page1MainApplication } from './pages/page1-main-application'
import { Page2FcraDisclosure } from './pages/page2-fcra-disclosure'
import { Page3LicenseCertification } from './pages/page3-license-certification'
import { Page4DrugAlcoholTest } from './pages/page4-drug-alcohol-test'
import { Page5SafetyPerformanceHistory } from './pages/page5-safety-performance-history'
import { Page6PspDisclosure } from './pages/page6-psp-disclosure'
import { Page7ClearinghouseLimitedQuery } from './pages/page7-clearinghouse-limited-query'
import { Page8MvrRelease } from './pages/page8-mvr-release'
import type { DriverApplication } from '@/types/database'
import { cn } from '@/lib/utils'

const PAGE_SCHEMAS = [
  page1Schema,
  page2Schema,
  page3Schema,
  page4Schema,
  page5Schema,
  page6Schema,
  page7Schema,
  page8Schema,
] as const

const TOTAL_PAGES = 8

interface ApplicationWizardProps {
  resumeToken: string
  application: DriverApplication
  tenantSlug: string
  tenantName: string
}

function buildDefaultValues(application: DriverApplication): Partial<FullApplication> {
  const data = application.application_data ?? {}
  return {
    page1: (data as Record<string, unknown>).page1 as FullApplication['page1'] | undefined ?? {
      applicantInfo: {
        firstName: application.first_name ?? '',
        lastName: application.last_name ?? '',
        dateOfBirth: application.date_of_birth ?? '',
        ssn: '',
        phone: application.phone ?? '',
        email: application.email ?? '',
        address: '',
        city: '',
        state: 'AL' as const,
        zip: '',
        lived3Years: true,
      },
      addressHistory: [],
      primaryLicense: {
        licenseNumber: application.license_number ?? '',
        state: (application.license_state ?? 'AL') as 'AL',
        class: 'A' as const,
        expires: '',
        endorsements: [],
        frontFilePath: '',
        backFilePath: '',
      },
      additionalLicenses: [],
      hasAdditionalLicenses: false,
      medicalCard: { filePath: '', expirationDate: '' },
      accidents: { hasAccidents: false, accidents: [] },
      violations: { hasViolations: false, violations: [] },
      forfeitures: { deniedLicense: false, deniedLicenseExplanation: '', revokedSuspended: false, revokedSuspendedExplanation: '' },
      employers: [{
        employerName: '',
        phone: '',
        fax: '',
        email: '',
        address: '',
        city: '',
        state: 'AL' as const,
        zip: '',
        position: '',
        dateFrom: '',
        dateTo: '',
        reasonForLeaving: '',
        equipmentClass: '',
        subjectToFmcsr: false,
        safetySensitive: false,
      }],
      employmentGapExplanation: '',
    },
    page2: (data as Record<string, unknown>).page2 as FullApplication['page2'] | undefined,
    page3: (data as Record<string, unknown>).page3 as FullApplication['page3'] | undefined,
    page4: (data as Record<string, unknown>).page4 as FullApplication['page4'] | undefined,
    page5: (data as Record<string, unknown>).page5 as FullApplication['page5'] | undefined,
    page6: (data as Record<string, unknown>).page6 as FullApplication['page6'] | undefined,
    page7: (data as Record<string, unknown>).page7 as FullApplication['page7'] | undefined,
    page8: (data as Record<string, unknown>).page8 as FullApplication['page8'] | undefined,
  }
}

export function ApplicationWizard({
  resumeToken,
  application,
  tenantSlug,
  tenantName,
}: ApplicationWizardProps) {
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [completedPages, setCompletedPages] = useState<Set<number>>(new Set())
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const pageHeadingRef = useRef<HTMLHeadingElement>(null)

  const form = useForm<FullApplication>({
    // zodResolver type mismatch: z.coerce.number() yields unknown in position field.
    // Cast is safe — schema validates at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(fullApplicationSchema as any),
    defaultValues: buildDefaultValues(application) as FullApplication,
    mode: 'onBlur',
  })

  // Focus page heading on page transition for accessibility
  function focusPageHeading() {
    setTimeout(() => pageHeadingRef.current?.focus(), 50)
  }

  async function autoSave(page: number) {
    const key = `page${page}` as `page${1|2|3|4|5|6|7|8}`
    const values = form.getValues(key)
    if (!values) return
    await updateDraftSection(resumeToken, key, values)
  }

  const handleNext = useCallback(async () => {
    if (isPending) return
    setServerError(null)

    const schema = PAGE_SCHEMAS[currentPage - 1]
    const key = `page${currentPage}` as `page${1|2|3|4|5|6|7|8}`
    const values = form.getValues(key)
    const result = schema.safeParse(values)

    if (!result.success) {
      // Trigger validation display on current page fields
      void form.trigger(key)
      return
    }

    startTransition(async () => {
      await autoSave(currentPage)
      setCompletedPages((prev) => new Set(prev).add(currentPage))
      setCurrentPage((p) => Math.min(p + 1, TOTAL_PAGES))
      focusPageHeading()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, form, isPending, resumeToken])

  const handleBack = useCallback(() => {
    if (currentPage <= 1) return
    setCurrentPage((p) => p - 1)
    focusPageHeading()
  }, [currentPage])

  const handleStepClick = useCallback((step: number) => {
    // Only allow navigating to completed or current pages
    if (step < currentPage || completedPages.has(step)) {
      setCurrentPage(step)
      focusPageHeading()
    }
  }, [currentPage, completedPages])

  async function handleSubmit() {
    if (isPending) return
    setServerError(null)

    // Validate page 8 before submitting
    const page8Values = form.getValues('page8')
    const page8Result = page8Schema.safeParse(page8Values)
    if (!page8Result.success) {
      await form.trigger('page8')
      return
    }

    startTransition(async () => {
      await autoSave(8)

      const result = await submitApplication(resumeToken)
      if ('error' in result) {
        setServerError(result.error)
        return
      }
      router.push(`/apply/${tenantSlug}/status/${result.statusToken}`)
    })
  }

  const PAGE_HEADINGS = [
    'Page 1 — Application for Employment',
    'Page 2 — Fair Credit Reporting Act Disclosure',
    'Page 3 — Driver License Requirements Certification',
    'Page 4 — Drug & Alcohol Test Statement',
    'Page 5 — Safety Performance History Investigation',
    'Page 6 — PSP Driver Disclosure & Authorization',
    'Page 7 — Clearinghouse Limited Query Consent',
    'Page 8 — MVR Release Consent',
  ] as const

  return (
    <FormProvider {...form}>
      <div className="flex min-h-screen flex-col">
        {/* Tab strip */}
        <div
          className="border-b border-white/10 px-4"
          style={{ backgroundColor: '#0C1220' }}
        >
          <div className="mx-auto max-w-4xl">
            <StepIndicator
              currentStep={currentPage}
              totalSteps={TOTAL_PAGES}
              onStepClick={handleStepClick}
              completedSteps={completedPages}
            />
          </div>
        </div>

        {/* Main content area — white card on dark background */}
        <main
          className="flex-1 px-4 py-6"
          style={{ backgroundColor: '#0C1220' }}
        >
          <div className="mx-auto max-w-4xl">
            {/* Page heading (sr-only but focusable for accessibility) */}
            <h2
              ref={pageHeadingRef}
              tabIndex={-1}
              className="sr-only focus:not-sr-only focus:mb-4 focus:text-white focus:text-lg focus:font-semibold focus:outline-none"
            >
              {PAGE_HEADINGS[currentPage - 1]}
            </h2>

            {/* Server error banner */}
            {serverError && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {serverError}
              </div>
            )}

            {/* White form card */}
            <div className="rounded-xl bg-white shadow-xl">
              {/* Page content */}
              <div className="px-6 py-6 sm:px-8 sm:py-8">
                {currentPage === 1 && (
                  <Page1MainApplication
                    resumeToken={resumeToken}
                    application={application}
                    tenantName={tenantName}
                    onConsentSigned={async (typedName) => {
                      const result = await signConsent(resumeToken, 'application_certification', typedName)
                      if ('error' in result) setServerError(result.error)
                    }}
                  />
                )}
                {currentPage === 2 && (
                  <Page2FcraDisclosure
                    onConsentSigned={async (typedName) => {
                      const result = await signConsent(resumeToken, 'fcra_disclosure', typedName)
                      if ('error' in result) setServerError(result.error)
                    }}
                  />
                )}
                {currentPage === 3 && (
                  <Page3LicenseCertification
                    onConsentSigned={async (typedName) => {
                      const result = await signConsent(resumeToken, 'driver_license_requirements_certification', typedName)
                      if ('error' in result) setServerError(result.error)
                    }}
                  />
                )}
                {currentPage === 4 && (
                  <Page4DrugAlcoholTest
                    onConsentSigned={async (typedName) => {
                      const result = await signConsent(resumeToken, 'drug_alcohol_testing_consent', typedName)
                      if ('error' in result) setServerError(result.error)
                    }}
                  />
                )}
                {currentPage === 5 && (
                  <Page5SafetyPerformanceHistory
                    application={application}
                    tenantName={tenantName}
                    onConsentSigned={async (typedName) => {
                      const result = await signConsent(resumeToken, 'safety_performance_history_investigation', typedName)
                      if ('error' in result) setServerError(result.error)
                    }}
                  />
                )}
                {currentPage === 6 && (
                  <Page6PspDisclosure
                    tenantName={tenantName}
                    onConsentSigned={async (typedName) => {
                      const result = await signConsent(resumeToken, 'psp_authorization', typedName)
                      if ('error' in result) setServerError(result.error)
                    }}
                  />
                )}
                {currentPage === 7 && (
                  <Page7ClearinghouseLimitedQuery
                    tenantName={tenantName}
                    onConsentSigned={async (typedName) => {
                      const result = await signConsent(resumeToken, 'clearinghouse_limited_query', typedName)
                      if ('error' in result) setServerError(result.error)
                    }}
                  />
                )}
                {currentPage === 8 && (
                  <Page8MvrRelease
                    tenantName={tenantName}
                    onConsentSigned={async (typedName) => {
                      const result = await signConsent(resumeToken, 'mvr_release', typedName)
                      if ('error' in result) setServerError(result.error)
                    }}
                  />
                )}
              </div>

              {/* Navigation footer */}
              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 sm:px-8">
                <div>
                  {currentPage > 1 && (
                    <button
                      type="button"
                      onClick={handleBack}
                      disabled={isPending}
                      className={cn(
                        'rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700',
                        'hover:bg-gray-50 transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] focus-visible:ring-offset-1',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      Back
                    </button>
                  )}
                </div>

                <div>
                  {currentPage < TOTAL_PAGES ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={isPending}
                      className={cn(
                        'rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-[filter,colors]',
                        'bg-[var(--brand-primary,#192334)] hover:brightness-110',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] focus-visible:ring-offset-1',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      {isPending ? 'Saving…' : 'Next'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isPending}
                      className={cn(
                        'rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-[filter,colors]',
                        'bg-[var(--brand-secondary,#fb7232)] hover:brightness-110',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-secondary,#fb7232)] focus-visible:ring-offset-1',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      {isPending ? 'Submitting…' : 'Submit Application'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Page counter */}
            <p className="mt-3 text-center text-xs text-white/30">
              Page {currentPage} of {TOTAL_PAGES}
            </p>
          </div>
        </main>
      </div>
    </FormProvider>
  )
}
