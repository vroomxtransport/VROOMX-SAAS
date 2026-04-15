'use client'

import { useState, useMemo } from 'react'
import { SignatureBox } from '../signature-box'
import { getMvrReleaseText } from '../consent-text'
import { CheckCircle2 } from 'lucide-react'

interface Page8Props {
  tenantName: string
  onConsentSigned: (typedName: string) => Promise<void>
}

/**
 * Page 8 — MVR Release Consent
 *
 * 18 USC 2721 / Federal Drivers Privacy Protection Act release.
 * Final page — shows green "You're almost done!" banner.
 * "Submit Application" button is in the parent ApplicationWizard's footer.
 *
 * Consent type: mvr_release
 */
export function Page8MvrRelease({ tenantName, onConsentSigned }: Page8Props) {
  const [isSigned, setIsSigned] = useState(false)
  const [sigError, setSigError] = useState<string | undefined>()
  const [typedName, setTypedName] = useState('')

  const legalText = useMemo(
    () => getMvrReleaseText({ tenantName }),
    [tenantName],
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
            Motor Vehicle Record (MVR) Release Consent
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          18 U.S.C. § 2721 — Federal Drivers Privacy Protection Act. Your written consent is required before your MVR can be obtained.
        </p>
      </header>

      <div
        className="rounded-xl border border-l-4 border-l-[var(--brand-primary,#192334)] bg-gradient-to-br from-slate-50/80 to-white p-6 text-[13px] leading-[1.85] text-gray-600 whitespace-pre-line"
        role="region"
        aria-label="MVR Release consent text"
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
          consentType="mvr_release"
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

      {/* Green "You're almost done!" banner */}
      {isSigned && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-5"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-green-800">You&apos;re almost done!</p>
            <p className="mt-1 text-xs text-green-700">
              All 8 sections are complete and signed. Click{' '}
              <strong>Submit Application</strong> below to submit your application to {tenantName}.
              You&apos;ll receive a status link by email so you can track your application progress.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
