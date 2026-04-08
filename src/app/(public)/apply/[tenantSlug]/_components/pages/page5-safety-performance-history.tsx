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
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-bold text-[#192334]">
          Safety Performance History Investigation
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          This authorization allows {tenantName} to investigate your prior employer safety history as required by 49 CFR § 391.23.
        </p>
      </header>

      {/* Interpolated legal text — applicant sees their name/SSN pre-filled */}
      <div
        className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-xs leading-relaxed text-gray-700 whitespace-pre-line"
        role="region"
        aria-label="Safety Performance History Investigation authorization text"
      >
        {legalText}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
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
            className="mt-3 rounded-lg bg-[var(--brand-primary,#192334)] px-5 py-2 text-sm font-semibold text-white hover:brightness-110 transition-[filter,colors] focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            Confirm Signature
          </button>
        )}
      </div>
    </div>
  )
}
