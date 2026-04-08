'use client'

import { useState, useTransition } from 'react'
import { requestResumeLink } from '@/app/actions/driver-applications'
import Link from 'next/link'

interface ResumeFormProps {
  tenantSlug: string
}

/**
 * Resume application form — applicant enters email, receives magic link.
 *
 * Uniform response regardless of whether an application exists for that email
 * (prevents email enumeration / application existence disclosure).
 */
export function ResumeForm({ tenantSlug }: ResumeFormProps) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    startTransition(async () => {
      const result = await requestResumeLink(tenantSlug, email.trim())
      // Always show the success message regardless of whether email matched
      // This prevents enumeration of which emails have applications
      if ('error' in result && result.error && result.error !== 'not_found') {
        setError('Something went wrong. Please try again.')
        return
      }
      setSubmitted(true)
    })
  }

  return (
    <div className="rounded-xl bg-white px-8 py-10 shadow-2xl">
      {!submitted ? (
        <>
          <div className="mb-8 space-y-2">
            <h1 className="text-xl font-bold text-[#192334]">Resume your application</h1>
            <p className="text-sm text-gray-500">
              Enter the email address you used when you started your application. We&apos;ll send you a secure link to continue where you left off.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="resume-email"
                className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500"
              >
                Email Address *
              </label>
              <input
                id="resume-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? 'resume-email-error' : undefined}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-[var(--brand-primary,#192334)] focus:ring-1 focus:ring-[var(--brand-primary,#192334)] placeholder:text-gray-400"
              />
              {error && (
                <p
                  id="resume-email-error"
                  role="alert"
                  className="text-xs text-red-600"
                >
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-[var(--brand-primary,#192334)] px-6 py-3 text-sm font-semibold text-white hover:brightness-110 transition-[filter,colors] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Sending…' : 'Send resume link'}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
            <Link
              href={`/apply/${tenantSlug}`}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              &larr; Back to application
            </Link>
          </div>
        </>
      ) : (
        /* Success state — always shown regardless of email match */
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[#192334]">Check your email</h2>
          <p className="text-sm text-gray-500">
            If an application exists for{' '}
            <span className="font-medium text-gray-700">{email}</span>,
            we&apos;ve sent you a secure link to resume your application. The link expires in 72 hours.
          </p>
          <p className="text-xs text-gray-400">
            Check your spam folder if you don&apos;t see it within a few minutes.
          </p>
          <Link
            href={`/apply/${tenantSlug}`}
            className="mt-2 inline-block text-xs text-[#192334] underline hover:text-[var(--brand-secondary,#fb7232)] transition-colors"
          >
            Return to application page
          </Link>
        </div>
      )}
    </div>
  )
}
