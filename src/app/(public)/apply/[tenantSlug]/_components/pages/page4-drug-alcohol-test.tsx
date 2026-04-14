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
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--brand-primary,#192334)]" aria-hidden="true" />
          <h2 className="text-xl font-semibold tracking-tight text-gray-900">
            Pre-Employment Alcohol and Drug Test Statement
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          As required by 49 CFR Part 40.25(j). Answer all questions honestly and completely.
        </p>
      </header>

      {/* Three Y/N questions */}
      <div className="space-y-5 rounded-xl border border-gray-100 bg-gradient-to-br from-slate-50/80 to-white p-6 shadow-[0_1px_3px_rgba(50,50,93,0.08),0_1px_1px_rgba(0,0,0,0.05)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Disclosure Questions</p>
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
        className="rounded-xl border border-yellow-200 border-l-4 border-l-yellow-400 bg-gradient-to-br from-yellow-50/80 to-white p-6 text-[13px] leading-[1.85] text-gray-700 whitespace-pre-line"
        role="region"
        aria-label="Drug and Alcohol Testing consent text"
      >
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-600/80">Legal Disclosure</p>
        {DRUG_ALCOHOL_TESTING_TEXT}
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
            className="mt-4 w-full rounded-lg bg-[var(--brand-primary,#192334)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 transition-[filter,colors] focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] focus-visible:ring-offset-1 focus-visible:outline-none sm:w-auto"
          >
            ✓ Confirm Signature
          </button>
        )}
      </div>
    </div>
  )
}
