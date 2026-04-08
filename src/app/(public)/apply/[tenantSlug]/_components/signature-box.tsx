'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface SignatureBoxProps {
  /** The consent type key — passed back to the parent on sign */
  consentType: string
  /** Called when the user successfully types a name */
  onChange: (typedName: string, dateSigned: string) => void
  /** Whether the consent has already been signed (persisted) */
  isSigned?: boolean
  /** Error message from the parent form */
  error?: string
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Reusable typed-name signature component.
 *
 * Visually matches the reference:
 * - Labeled "PROSPECTIVE EMPLOYEE SIGNATURE *"
 * - Box with typed name rendered live in Caveat (handwriting) font
 * - × clear button top-right of the box
 * - Adjacent "DATE SIGNED *" field prefilled with today
 * - "Signed ✓" badge once isSigned = true
 *
 * WCAG: role="textbox", aria-label, visible focus ring, keyboard accessible.
 */
export function SignatureBox({
  consentType,
  onChange,
  isSigned = false,
  error,
}: SignatureBoxProps) {
  const [typedName, setTypedName] = useState('')
  const [dateSigned, setDateSigned] = useState(todayIso())

  function handleNameChange(value: string) {
    setTypedName(value)
    onChange(value, dateSigned)
  }

  function handleDateChange(value: string) {
    setDateSigned(value)
    onChange(typedName, value)
  }

  function handleClear() {
    setTypedName('')
    onChange('', dateSigned)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        {/* Signature capture box */}
        <div className="flex-1 space-y-1.5">
          <label
            htmlFor={`sig-name-${consentType}`}
            className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500"
          >
            Prospective Employee Signature *
          </label>

          <div
            className={cn(
              'relative min-h-[64px] rounded border bg-white transition-shadow',
              error
                ? 'border-red-400 ring-1 ring-red-400'
                : isSigned
                  ? 'border-green-400'
                  : 'border-gray-300 focus-within:border-[#192334] focus-within:ring-1 focus-within:ring-[#192334]',
            )}
          >
            {/* Live preview in Caveat / handwriting font */}
            {typedName && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center px-3 text-2xl text-gray-800 leading-none"
                style={{ fontFamily: 'var(--font-signature, cursive)' }}
              >
                {typedName}
              </span>
            )}

            {/* Hidden-visually but focusable input */}
            <input
              id={`sig-name-${consentType}`}
              type="text"
              role="textbox"
              aria-label="Type your full legal name to sign"
              aria-required="true"
              aria-invalid={!!error}
              aria-describedby={error ? `sig-error-${consentType}` : undefined}
              value={typedName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={!typedName ? 'Type your full legal name' : ''}
              autoComplete="name"
              className={cn(
                'absolute inset-0 w-full rounded bg-transparent px-3 py-2 text-sm outline-none',
                // Make text transparent when previewing in Caveat font
                typedName ? 'text-transparent caret-gray-400' : 'text-gray-800 placeholder:text-gray-400',
              )}
            />

            {/* Clear button */}
            {typedName && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear signature"
                className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 focus-visible:ring-2 focus-visible:ring-[#fb7232] transition-colors"
              >
                <span aria-hidden="true" className="text-xs leading-none">&times;</span>
              </button>
            )}
          </div>

          {/* Signed state indicator */}
          {isSigned && (
            <p className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <span aria-hidden="true">&#10003;</span>
              Signed
            </p>
          )}

          {/* Inline error */}
          {error && (
            <p
              id={`sig-error-${consentType}`}
              role="alert"
              className="text-xs text-red-600"
            >
              {error}
            </p>
          )}
        </div>

        {/* Date Signed field */}
        <div className="space-y-1.5 sm:w-44">
          <label
            htmlFor={`sig-date-${consentType}`}
            className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500"
          >
            Date Signed *
          </label>
          <input
            id={`sig-date-${consentType}`}
            type="date"
            value={dateSigned}
            onChange={(e) => handleDateChange(e.target.value)}
            aria-label="Date signed"
            aria-required="true"
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#192334] focus:ring-1 focus:ring-[#192334]"
          />
        </div>
      </div>
    </div>
  )
}
