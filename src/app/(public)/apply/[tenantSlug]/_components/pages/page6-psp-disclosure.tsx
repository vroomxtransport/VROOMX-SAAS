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
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--brand-primary,#192334)]" aria-hidden="true" />
          <h2 className="text-xl font-semibold tracking-tight text-gray-900">
            PSP Driver Disclosure &amp; Authorization
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          FMCSA Pre-Employment Screening Program (PSP) mandatory disclosure. This document must be signed as a standalone authorization.
        </p>
      </header>

      <div
        className="rounded-xl border border-l-4 border-l-[var(--brand-primary,#192334)] bg-gradient-to-br from-slate-50/80 to-white p-6 text-[13px] leading-[1.85] text-gray-600 whitespace-pre-line"
        role="region"
        aria-label="PSP Authorization text"
      >
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Legal Disclosure</p>
        {legalText}
      </div>

      {/* Full Name field — required by PSP */}
      <div className="space-y-1">
        <label
          htmlFor="psp-full-name"
          className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
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
            'focus:border-[var(--brand-primary,#192334)] focus:ring-1 focus:ring-[var(--brand-primary,#192334)]',
            'border-gray-300',
          )}
        />
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
            className="mt-4 w-full rounded-lg bg-[var(--brand-primary,#192334)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 transition-[filter,colors] focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] focus-visible:ring-offset-1 focus-visible:outline-none sm:w-auto"
          >
            ✓ Confirm Signature
          </button>
        )}
      </div>
    </div>
  )
}
