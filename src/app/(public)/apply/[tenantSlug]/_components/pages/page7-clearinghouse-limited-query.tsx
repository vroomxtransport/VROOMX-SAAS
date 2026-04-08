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
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-bold text-[#192334]">
          General Consent for Limited Queries of the FMCSA Drug &amp; Alcohol Clearinghouse
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          This consent covers ongoing limited queries during your period of employment with {tenantName}.
        </p>
      </header>

      <div
        className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-xs leading-relaxed text-gray-700 whitespace-pre-line"
        role="region"
        aria-label="Clearinghouse Limited Query consent text"
      >
        {legalText}
      </div>

      {/* Clearinghouse registration question */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Are you registered with the FMCSA Drug &amp; Alcohol Clearinghouse?
          </p>
          <div className="flex gap-6">
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
          <p className="text-[11px] text-gray-400">
            This information helps determine if you need to register before the carrier can run the pre-employment query.
          </p>
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
            className="mt-3 rounded-lg bg-[#192334] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2a3a4f] transition-colors focus-visible:ring-2 focus-visible:ring-[#192334] focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            Confirm Signature
          </button>
        )}
      </div>
    </div>
  )
}
