'use client'

import { useState } from 'react'
import { SignatureBox } from '../signature-box'
import { DRIVER_LICENSE_REQUIREMENTS_TEXT } from '../consent-text'

interface Page3Props {
  onConsentSigned: (typedName: string) => Promise<void>
}

/**
 * Page 3 — Certification of Compliance with Driver License Requirements
 * Consent type: driver_license_requirements_certification
 */
export function Page3LicenseCertification({ onConsentSigned }: Page3Props) {
  const [isSigned, setIsSigned] = useState(false)
  const [sigError, setSigError] = useState<string | undefined>()
  const [typedName, setTypedName] = useState('')

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
          Certification of Compliance with Driver License Requirements
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Please read and sign this certification regarding 49 CFR Parts 383 and 391.
        </p>
      </header>

      <div
        className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-xs leading-relaxed text-gray-700 whitespace-pre-line"
        role="region"
        aria-label="Driver License Requirements Certification text"
      >
        {DRIVER_LICENSE_REQUIREMENTS_TEXT}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <SignatureBox
          consentType="driver_license_requirements_certification"
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
