'use client'

import { useState } from 'react'
import { useFormContext, Controller } from 'react-hook-form'
import type { FullApplication } from '@/lib/validations/driver-application'
import { SignatureBox } from '../signature-box'
import { DRUG_ALCOHOL_TESTING_TEXT } from '../consent-text'

interface Page4Props {
  onConsentSigned: (typedName: string) => Promise<void>
}

/**
 * Page 4 — Pre-Employment Drug & Alcohol Test Statement (49 CFR Part 40.25(j))
 *
 * Three Yes/No questions + conditional + yellow-highlighted consent block + signature.
 * Consent type: drug_alcohol_testing_consent
 */
export function Page4DrugAlcoholTest({ onConsentSigned }: Page4Props) {
  const { control, watch } = useFormContext<FullApplication>()
  const [isSigned, setIsSigned] = useState(false)
  const [sigError, setSigError] = useState<string | undefined>()
  const [typedName, setTypedName] = useState('')

  const positiveDrugTest = watch('page4.drugAlcoholQuestions.positiveDrugTest')
  const alcoholConcentration = watch('page4.drugAlcoholQuestions.alcoholConcentration04')
  const refusedTest = watch('page4.drugAlcoholQuestions.refusedTest')
  const anyYes = positiveDrugTest || alcoholConcentration || refusedTest

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
          Pre-Employment Alcohol and Drug Test Statement
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          As required by 49 CFR Part 40.25(j). Answer all questions honestly and completely.
        </p>
      </header>

      {/* Three Y/N questions */}
      <div className="space-y-5 rounded-lg border border-gray-200 bg-gray-50 p-5">
        {[
          {
            name: 'page4.drugAlcoholQuestions.positiveDrugTest' as const,
            label: 'a. Have you ever tested positive for a controlled substance?',
          },
          {
            name: 'page4.drugAlcoholQuestions.alcoholConcentration04' as const,
            label: 'b. Have you ever had an alcohol concentration of .04 or greater while on duty or just before duty?',
          },
          {
            name: 'page4.drugAlcoholQuestions.refusedTest' as const,
            label: 'c. Have you ever refused a required test for drugs or alcohol?',
          },
        ].map((q) => (
          <div key={q.name} className="space-y-2">
            <p className="text-xs font-medium text-gray-800">{q.label}</p>
            <div className="flex gap-6">
              {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
                <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <Controller
                    control={control}
                    name={q.name}
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
          </div>
        ))}

        {/* Conditional follow-up */}
        {anyYes && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-800">
              If yes, can you provide documentation of successful completion of DOT return-to-duty requirements (including follow-up tests)?
            </p>
            <div className="flex gap-6">
              {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
                <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <Controller
                    control={control}
                    name="page4.drugAlcoholQuestions.returnToDutyDocs"
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
          </div>
        )}
      </div>

      {/* Yellow-highlighted consent block */}
      <div
        className="rounded-lg border border-yellow-300 bg-yellow-50 p-5 text-xs leading-relaxed text-gray-800 whitespace-pre-line"
        role="region"
        aria-label="Drug and Alcohol Testing consent text"
      >
        {DRUG_ALCOHOL_TESTING_TEXT}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <SignatureBox
          consentType="drug_alcohol_testing_consent"
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
