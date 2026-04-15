'use client'

import { useState, useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import type { FullApplication } from '@/lib/validations/driver-application'
import { SignatureBox } from '../signature-box'
import { getSafetyPerformanceHistoryText } from '../consent-text'
import type { DriverApplication } from '@/types/database'

interface Page5Props {
  application: DriverApplication
  tenantName: string
  onConsentSigned: (typedName: string) => Promise<void>
}

/**
 * Page 5 — Safety Performance History Investigation (§ 391.23 + § 40.25)
 *
 * Full verbatim legal text with INTERPOLATED placeholders from Page 1:
 *   "I, {firstName} {lastName}, social security xxx-xx-{ssnLast4}, hereby authorize..."
 *
 * Consent type: safety_performance_history_investigation
 */
export function Page5SafetyPerformanceHistory({
  application,
  tenantName,
  onConsentSigned,
}: Page5Props) {
  const { watch } = useFormContext<FullApplication>()
  const [isSigned, setIsSigned] = useState(false)
  const [sigError, setSigError] = useState<string | undefined>()
  const [typedName, setTypedName] = useState('')

  // Pull applicant info from form state (page 1) for interpolation
  const firstName = watch('page1.applicantInfo.firstName') ?? application.first_name ?? ''
  const lastName = watch('page1.applicantInfo.lastName') ?? application.last_name ?? ''
  // SSN last 4 from the DB extracted value, or parse from form (never display full SSN)
  const ssnLast4 = application.ssn_last4 ?? '????'

  const legalText = useMemo(
    () => getSafetyPerformanceHistoryText({ firstName, lastName, ssnLast4, tenantName }),
    [firstName, lastName, ssnLast4, tenantName],
  )

  async function handleSign(name: string) {
    if (!name.trim()) {
      setSigError('Please type your full legal name to sign.')
      return
    }
    await onConsentSigned(name)
    setIsSigned(true)
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--brand-primary,#192334)]" aria-hidden="true" />
          <h2 className="text-xl font-semibold tracking-tight text-gray-900">
            Safety Performance History Investigation
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This authorization allows {tenantName} to investigate your prior employer safety history as required by 49 CFR § 391.23.
        </p>
      </header>

      {/* Interpolated legal text — applicant sees their name/SSN pre-filled */}
      <div
        className="rounded-xl border border-l-4 border-l-[var(--brand-primary,#192334)] bg-gradient-to-br from-slate-50/80 to-white p-6 text-[13px] leading-[1.85] text-gray-600 whitespace-pre-line"
        role="region"
        aria-label="Safety Performance History Investigation authorization text"
      >
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Legal Disclosure</p>
        {legalText}
      </div>

      {/* Divider */}
      <div className="relative flex items-center gap-4">
        <div className="h-px flex-1 bg-gray-100" />
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Sign Below
        </span>
        <div className="h-px flex-1 bg-gray-100" />
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-[0_1px_3px_rgba(50,50,93,0.08),0_1px_1px_rgba(0,0,0,0.05)]">
        <SignatureBox
          consentType="safety_performance_history_investigation"
          onChange={(name) => {
            setTypedName(name)
            setSigError(undefined)
          }}
          isSigned={isSigned}
          error={sigError}
        />
        {!isSigned && typedName && (
          <button
            type="button"
            onClick={() => void handleSign(typedName)}
            className="mt-4 w-full rounded-lg bg-[var(--brand-primary,#192334)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 transition-[filter,colors] focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] focus-visible:ring-offset-1 focus-visible:outline-none sm:w-auto"
          >
            ✓ Confirm Signature
          </button>
        )}
      </div>
    </div>
  )
}
