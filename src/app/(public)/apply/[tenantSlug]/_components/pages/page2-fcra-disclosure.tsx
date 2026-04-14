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
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--brand-primary,#192334)]" aria-hidden="true" />
          <h2 className="text-xl font-semibold tracking-tight text-gray-900">
            Fair Credit Reporting Act Disclosure Statement
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Please read the following disclosure carefully, then sign below.
        </p>
      </header>

      {/* Legal text */}
      <div
        className="rounded-xl border border-gray-100 border-l-4 border-l-[var(--brand-primary,#192334)] bg-gradient-to-br from-slate-50/80 to-white p-6 text-[13px] leading-[1.85] text-gray-600 whitespace-pre-line"
        role="region"
        aria-label="FCRA Disclosure text"
      >
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Legal Disclosure</p>
        {FCRA_DISCLOSURE_TEXT}
      </div>

      {/* Divider */}
      <div className="relative flex items-center gap-4">
        <div className="h-px flex-1 bg-gray-100" />
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Sign Below
        </span>
        <div className="h-px flex-1 bg-gray-100" />
      </div>

      {/* Signature */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-[0_1px_3px_rgba(50,50,93,0.08),0_1px_1px_rgba(0,0,0,0.05)]">
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
            className="mt-4 w-full rounded-lg bg-[var(--brand-primary,#192334)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 transition-[filter,colors] focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] focus-visible:ring-offset-1 focus-visible:outline-none sm:w-auto"
          >
            ✓ Confirm Signature
          </button>
        )}
      </div>
    </div>
  )
}
