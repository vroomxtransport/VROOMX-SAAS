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
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--brand-primary,#192334)]" aria-hidden="true" />
          <h2 className="text-xl font-semibold tracking-tight text-gray-900">
            Certification of Compliance with Driver License Requirements
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Please read and sign this certification regarding 49 CFR Parts 383 and 391.
        </p>
      </header>

      <div
        className="rounded-xl border border-gray-100 border-l-4 border-l-[var(--brand-primary,#192334)] bg-gradient-to-br from-slate-50/80 to-white p-6 text-[13px] leading-[1.85] text-gray-600 whitespace-pre-line"
        role="region"
        aria-label="Driver License Requirements Certification text"
      >
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Legal Disclosure</p>
        {DRIVER_LICENSE_REQUIREMENTS_TEXT}
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
            className="mt-4 w-full rounded-lg bg-[var(--brand-primary,#192334)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 transition-[filter,colors] focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] focus-visible:ring-offset-1 focus-visible:outline-none sm:w-auto"
          >
            ✓ Confirm Signature
          </button>
        )}
      </div>
    </div>
  )
}
