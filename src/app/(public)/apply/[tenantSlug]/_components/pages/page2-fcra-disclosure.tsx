'use client'

import { useState } from 'react'
import { SignatureBox } from '../signature-box'
import { FCRA_DISCLOSURE_TEXT } from '../consent-text'

interface Page2Props {
  onConsentSigned: (typedName: string) => Promise<void>
}

/**
 * Page 2 — Fair Credit Reporting Act Disclosure Statement
 * Full verbatim legal text + signature box.
 * Consent type: fcra_disclosure
 */
export function Page2FcraDisclosure({ onConsentSigned }: Page2Props) {
  const [isSigned, setIsSigned] = useState(false)
  const [sigError, setSigError] = useState<string | undefined>()
  const [typedName, setTypedName] = useState('')

  function handleSignatureChange(name: string) {
    setTypedName(name)
    setSigError(undefined)
  }

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
          Fair Credit Reporting Act Disclosure Statement
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Please read the following disclosure carefully, then sign below.
        </p>
      </header>

      {/* Legal text */}
      <div
        className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-xs leading-relaxed text-gray-700 whitespace-pre-line"
        role="region"
        aria-label="FCRA Disclosure text"
      >
        {FCRA_DISCLOSURE_TEXT}
      </div>

      {/* Signature */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <SignatureBox
          consentType="fcra_disclosure"
          onChange={(name) => handleSignatureChange(name)}
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
