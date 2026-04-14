'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface SignatureBoxProps {
  consentType: string
  onChange: (typedName: string, dateSigned: string) => void
  isSigned?: boolean
  error?: string
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

export function SignatureBox({
  consentType,
  onChange,
  isSigned = false,
  error,
}: SignatureBoxProps) {
  const [typedName, setTypedName] = useState('')
  const [dateSigned, setDateSigned] = useState(todayIso())
  const [isPulsing, setIsPulsing] = useState(false)

  useEffect(() => {
    if (isSigned) setIsPulsing(true)
  }, [isSigned])

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
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes sig-badge-in {
            from { opacity: 0; transform: scale(0.82) translateY(2px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes sig-border-pulse {
            0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.3); }
            50%  { box-shadow: 0 0 0 5px rgba(34,197,94,0.15); }
            100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
          }
          .sig-badge { animation: sig-badge-in 200ms ease-out both; }
          .sig-pulse { animation: sig-border-pulse 650ms ease-out forwards; }
        }
      `}</style>

      <div className="space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex-1 space-y-1.5">
            <label
              htmlFor={`sig-name-${consentType}`}
              className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Prospective Employee Signature *
            </label>

            <div
              onAnimationEnd={() => setIsPulsing(false)}
              className={cn(
                'relative min-h-[56px] sm:min-h-[64px] rounded-lg border bg-white',
                'transition-[border-color,box-shadow] duration-200',
                isPulsing && 'sig-pulse',
                error
                  ? 'border-red-400 ring-1 ring-red-400'
                  : isSigned
                    ? 'border-green-400'
                    : 'border-gray-300 focus-within:border-[var(--brand-primary,#192334)] focus-within:shadow-[0_0_0_3px_rgba(25,35,52,0.12)]',
              )}
            >
              {typedName && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center px-3 text-2xl text-gray-800 leading-none"
                  style={{ fontFamily: 'var(--font-signature, cursive)' }}
                >
                  {typedName}
                </span>
              )}

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
                style={{ fontSize: '16px' }}
                className={cn(
                  'absolute inset-0 w-full rounded-lg bg-transparent px-3 py-2 outline-none',
                  typedName ? 'text-transparent caret-gray-400' : 'text-gray-800 placeholder:text-muted-foreground',
                )}
              />

              {typedName && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear signature"
                  className={cn(
                    'absolute right-1 top-1 -m-2.5 p-2.5',
                    'flex h-6 w-6 items-center justify-center rounded-full',
                    'bg-gray-100 text-muted-foreground text-sm',
                    'hover:bg-red-50 hover:text-red-500 hover:scale-105',
                    'focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)]',
                    'transition-all duration-150',
                  )}
                >
                  <span aria-hidden="true" className="leading-none">&times;</span>
                </button>
              )}
            </div>

            {isSigned && (
              <p className="sig-badge flex items-center gap-1 text-xs text-green-600 font-medium">
                <span aria-hidden="true">&#10003;</span>
                Signed
              </p>
            )}

            {error && (
              <p id={`sig-error-${consentType}`} role="alert" className="text-xs text-red-600">
                {error}
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:w-44">
            <label
              htmlFor={`sig-date-${consentType}`}
              className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
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
              style={{ fontSize: '16px' }}
              className={cn(
                'w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 outline-none',
                'transition-[border-color,box-shadow] duration-200',
                'focus:border-[var(--brand-primary,#192334)] focus:shadow-[0_0_0_3px_rgba(25,35,52,0.12)]',
              )}
            />
          </div>
        </div>
      </div>
    </>
  )
}
