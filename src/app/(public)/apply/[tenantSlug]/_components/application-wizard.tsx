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

import { useState, useCallback, useTransition, useRef, useEffect } from 'react'
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

const PAGE_SHORT_HEADINGS = [
  'Personal Information',
  'FCRA Disclosure',
  'License Certification',
  'Drug & Alcohol',
  'Safety Performance',
  'PSP Authorization',
  'Clearinghouse Consent',
  'MVR Release',
] as const

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

  // Page transition animation state
  const [direction, setDirection] = useState<'next' | 'back'>('next')
  const [pageKey, setPageKey] = useState(0)

  // Auto-save indicator
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    if (!savedAt) return
    setShowSaved(true)
    const t = setTimeout(() => setShowSaved(false), 2000)
    return () => clearTimeout(t)
  }, [savedAt])

  const form = useForm<FullApplication>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(fullApplicationSchema as any),
    defaultValues: buildDefaultValues(application) as FullApplication,
    mode: 'onBlur',
  })

  function focusPageHeading() {
    setTimeout(() => pageHeadingRef.current?.focus(), 50)
  }

  async function autoSave(page: number) {
    const key = `page${page}` as `page${1|2|3|4|5|6|7|8}`
    const values = form.getValues(key)
    if (!values) return
    await updateDraftSection(resumeToken, key, values)
    setSavedAt(Date.now())
  }

  const handleNext = useCallback(async () => {
    if (isPending) return
    setServerError(null)

    // ⚠️ TESTING MODE: page validation bypassed — skip straight to next page
    // TODO: Uncomment before production
    // const schema = PAGE_SCHEMAS[currentPage - 1]
    // const key = `page${currentPage}` as `page${1|2|3|4|5|6|7|8}`
    // const values = form.getValues(key)
    // const result = schema.safeParse(values)
    //
    // if (!result.success) {
    //   void form.trigger(key)
    //   return
    // }

    startTransition(async () => {
      // await autoSave(currentPage) // skip auto-save in testing mode
      setDirection('next')
      setPageKey((k) => k + 1)
      setCompletedPages((prev) => new Set(prev).add(currentPage))
      setCurrentPage((p) => Math.min(p + 1, TOTAL_PAGES))
      focusPageHeading()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, form, isPending, resumeToken])

  const handleBack = useCallback(() => {
    if (currentPage <= 1) return
    setDirection('back')
    setPageKey((k) => k + 1)
    setCurrentPage((p) => p - 1)
    focusPageHeading()
  }, [currentPage])

  const handleStepClick = useCallback((step: number) => {
    // ⚠️ TESTING MODE: allow jumping to any page
    // TODO: Restore guard before production:
    // if (step < currentPage || completedPages.has(step)) {
    setDirection(step >= currentPage ? 'next' : 'back')
    setPageKey((k) => k + 1)
    setCurrentPage(step)
    focusPageHeading()
    // }
  }, [currentPage, completedPages])

  async function handleSubmit() {
    if (isPending) return
    setServerError(null)

    // ⚠️ TESTING MODE: page 8 validation bypassed
    // TODO: Uncomment before production
    // const page8Values = form.getValues('page8')
    // const page8Result = page8Schema.safeParse(page8Values)
    // if (!page8Result.success) {
    //   await form.trigger('page8')
    //   return
    // }

    startTransition(async () => {
      // await autoSave(8) // skip auto-save in testing mode

      const result = await submitApplication(resumeToken)
      if ('error' in result) {
        setServerError(result.error)
        return
      }
      router.push(`/apply/${tenantSlug}/status/${result.statusToken}`)
    })
  }

  return (
    <FormProvider {...form}>
      {/* Page transition animations */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes page-slide-next {
            from { opacity: 0; transform: translateX(20px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes page-slide-back {
            from { opacity: 0; transform: translateX(-20px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          .page-anim-next { animation: page-slide-next 200ms ease both; }
          .page-anim-back { animation: page-slide-back 200ms ease both; }
        }
      `}</style>

      <div className="flex min-h-[calc(100vh-56px)] flex-col">
        {/* Step indicator strip */}
        <div className="sticky top-[56px] z-10 border-b border-gray-200/60 bg-white/80 backdrop-blur-lg px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <StepIndicator
              currentStep={currentPage}
              totalSteps={TOTAL_PAGES}
              onStepClick={handleStepClick}
              completedSteps={completedPages}
            />
          </div>
        </div>

        {/* Full-page content area */}
        <main className="flex-1">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
            {/* Server error banner */}
            {serverError && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm"
              >
                {serverError}
              </div>
            )}

            {/* Page heading */}
            <div className="mb-8">
              <h2
                ref={pageHeadingRef}
                tabIndex={-1}
                aria-live="polite"
                className="text-2xl font-semibold tracking-tight text-gray-900 focus:outline-none"
              >
                {PAGE_SHORT_HEADINGS[currentPage - 1]}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Step {currentPage} of {TOTAL_PAGES}
              </p>
            </div>

            {/* Page content with transition animation */}
            <div
              key={pageKey}
              className={cn(
                'pb-28 sm:pb-8',
                direction === 'next' ? 'page-anim-next' : 'page-anim-back',
              )}
            >
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

            {/* Navigation footer — sticky on mobile, static on desktop */}
            <div
              className={cn(
                'flex items-center justify-between py-4',
                'fixed bottom-0 left-0 right-0 z-10 px-4 sm:px-6',
                'backdrop-blur-md bg-white/90 border-t border-gray-200',
                '[padding-bottom:env(safe-area-inset-bottom)]',
                'sm:static sm:bottom-auto sm:left-auto sm:right-auto sm:z-auto sm:px-0',
                'sm:bg-transparent sm:backdrop-blur-none sm:border-t sm:border-gray-200/60 sm:mt-10 sm:pt-6',
              )}
            >
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
                      {isPending ? 'Saving...' : 'Next'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isPending}
                      className={cn(
                        'rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-[filter,colors]',
                        'bg-[var(--brand-primary,#192334)] hover:brightness-110',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] focus-visible:ring-offset-1',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      {isPending ? 'Submitting...' : 'Submit Application'}
                    </button>
                  )}
                </div>
            </div>

            {/* Page counter + save indicator */}
            <div className="mt-4 flex items-center justify-center gap-4 pb-6">
              <p className="text-center text-xs text-muted-foreground">
                Page {currentPage} of {TOTAL_PAGES}
              </p>
              <span
                aria-live="polite"
                className={cn(
                  'text-xs text-muted-foreground transition-opacity duration-500',
                  showSaved ? 'opacity-100' : 'opacity-0',
                )}
              >
                Saved
              </span>
            </div>
          </div>
        </main>
      </div>
    </FormProvider>
  )
}
