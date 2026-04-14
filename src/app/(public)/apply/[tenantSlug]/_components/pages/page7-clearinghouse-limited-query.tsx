'use client'

import { useState, useMemo } from 'react'
import { useFormContext, Controller } from 'react-hook-form'
import type { FullApplication } from '@/lib/validations/driver-application'
import { SignatureBox } from '../signature-box'
import { getClearinghouseLimitedQueryText } from '../consent-text'

interface Page7Props {
  tenantName: string
  onConsentSigned: (typedName: string) => Promise<void>
}

/**
 * Page 7 — General Consent for Limited Queries of FMCSA Drug & Alcohol Clearinghouse
 *
 * Important nuance: LIMITED-query multi-year consent (ongoing employment).
 * NOT the pre-employment full query (that's done on the FMCSA portal).
 *
 * Consent type: clearinghouse_limited_query
 */
export function Page7ClearinghouseLimitedQuery({ tenantName, onConsentSigned }: Page7Props) {
  const { control } = useFormContext<FullApplication>()
  const [isSigned, setIsSigned] = useState(false)
  const [sigError, setSigError] = useState<string | undefined>()
  const [typedName, setTypedName] = useState('')

  const legalText = useMemo(
    () => getClearinghouseLimitedQueryText({ tenantName }),
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
            General Consent for Limited Queries of the FMCSA Drug &amp; Alcohol Clearinghouse
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This consent covers ongoing limited queries during your period of employment with {tenantName}.
        </p>
      </header>

      <div
        className="rounded-xl border border-gray-100 border-l-4 border-l-[var(--brand-primary,#192334)] bg-gradient-to-br from-slate-50/80 to-white p-6 text-[13px] leading-[1.85] text-gray-600 whitespace-pre-line"
        role="region"
        aria-label="Clearinghouse Limited Query consent text"
      >
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Legal Disclosure</p>
        {legalText}
      </div>

      {/* Clearinghouse registration question */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-[0_1px_3px_rgba(50,50,93,0.08),0_1px_1px_rgba(0,0,0,0.05)]">
        <div className="mb-6 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Registration Status
          </p>
          <p className="text-xs font-semibold text-gray-700">
            Are you registered with the FMCSA Drug &amp; Alcohol Clearinghouse?
          </p>
          <div className="flex gap-6 pt-1">
            {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
              <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Controller
                  control={control}
                  name="page7.clearinghouseRegistered"
                  render={({ field }) => (
                    <input
                      type="radio"
                      checked={field.value === value}
                      onChange={() => field.onChange(value)}
                      className="h-4 w-4 accent-[#192334]"
                    />
                  )}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            This information helps determine if you need to register before the carrier can run the pre-employment query.
          </p>
        </div>

        {/* Divider */}
        <div className="relative mb-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-100" />
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Sign Below
          </span>
          <div className="h-px flex-1 bg-gray-100" />
        </div>

        <SignatureBox
          consentType="clearinghouse_limited_query"
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
