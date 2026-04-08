'use client'

import { useState, useMemo } from 'react'
import { SignatureBox } from '../signature-box'
import { getPspAuthorizationText } from '../consent-text'
import { cn } from '@/lib/utils'

interface Page6Props {
  tenantName: string
  onConsentSigned: (typedName: string) => Promise<void>
}

/**
 * Page 6 — PSP Driver Disclosure & Authorization
 *
 * Mandatory FMCSA language (verbatim, stand-alone document).
 * Includes tenant name interpolated.
 * Consent type: psp_authorization
 */
export function Page6PspDisclosure({ tenantName, onConsentSigned }: Page6Props) {
  const [isSigned, setIsSigned] = useState(false)
  const [sigError, setSigError] = useState<string | undefined>()
  const [typedName, setTypedName] = useState('')
  const [fullName, setFullName] = useState('')

  const legalText = useMemo(
    () => getPspAuthorizationText({ tenantName }),
    [tenantName],
  )

  async function handleSign(name: string) {
    if (!name.trim()) {
      setSigError('Please type your full legal name to sign.')
      return
    }
    if (!fullName.trim()) {
      setSigError('Please enter your full name in the Full Name field above.')
      return
    }
    await onConsentSigned(name)
    setIsSigned(true)
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-bold text-[#192334]">
          PSP Driver Disclosure &amp; Authorization
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          FMCSA Pre-Employment Screening Program (PSP) mandatory disclosure. This document must be signed as a standalone authorization.
        </p>
      </header>

      <div
        className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-xs leading-relaxed text-gray-700 whitespace-pre-line"
        role="region"
        aria-label="PSP Authorization text"
      >
        {legalText}
      </div>

      {/* Full Name field — required by PSP */}
      <div className="space-y-1">
        <label
          htmlFor="psp-full-name"
          className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500"
        >
          Full Name * (as it appears on your driver&apos;s license)
        </label>
        <input
          id="psp-full-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          placeholder="Your full legal name"
          className={cn(
            'w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 outline-none',
            'focus:border-[#192334] focus:ring-1 focus:ring-[#192334]',
            'border-gray-300',
          )}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <SignatureBox
          consentType="psp_authorization"
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
            className="mt-3 rounded-lg bg-[#192334] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2a3a4f] transition-colors focus-visible:ring-2 focus-visible:ring-[#192334] focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            Confirm Signature
          </button>
        )}
      </div>
    </div>
  )
}
