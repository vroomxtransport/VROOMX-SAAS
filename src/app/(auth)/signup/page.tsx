'use client'

import { signUpAction } from '@/app/actions/auth'
import { AnimatedInput, BoxReveal, BottomGradient, AnimatedLabel } from '@/components/blocks/modern-animated-sign-in'
import { TIER_LIMITS, TIER_PRICING } from '@/types'
import Link from 'next/link'
import { useActionState, useState, useRef, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Plan = 'starter' | 'pro' | 'enterprise'

type FmcsaData = {
  legalName: string
  dbaName: string
  mcNumber: string
  dotNumber: string
  telephone: string
  phyStreet: string
  phyCity: string
  phyState: string
  phyZipcode: string
  allowToOperate: string
}

const PLAN_INFO: Record<Plan, { name: string; description: string }> = {
  starter: { name: 'Starter', description: `Up to ${TIER_LIMITS.starter.trucks} trucks, ${TIER_LIMITS.starter.users} users` },
  pro: { name: 'Pro', description: `Up to ${TIER_LIMITS.pro.trucks} trucks, ${TIER_LIMITS.pro.users} users` },
  enterprise: { name: 'Enterprise', description: 'Unlimited trucks and users' },
}

function RevealSection({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`grid transition-all duration-500 ease-in-out ${
        show ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
              i + 1 < step
                ? 'bg-brand text-white'
                : i + 1 === step
                  ? 'bg-brand text-white ring-2 ring-brand/30 ring-offset-2 ring-offset-background'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1 < step ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          {i < total - 1 && (
            <div
              className={`h-0.5 w-8 rounded transition-all duration-500 ${
                i + 1 < step ? 'bg-brand' : 'bg-muted'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function SignupForm() {
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite_token')
  const [state, formAction, isPending] = useActionState(signUpAction, null)
  const [selectedPlan, setSelectedPlan] = useState<Plan>('starter')
  const [showPassword, setShowPassword] = useState(false)

  // DOT lookup state
  const [dotValue, setDotValue] = useState('')
  const [dotLoading, setDotLoading] = useState(false)
  const [dotError, setDotError] = useState('')
  const [fmcsaData, setFmcsaData] = useState<FmcsaData | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyCity, setCompanyCity] = useState('')
  const [companyState, setCompanyState] = useState('')
  const [companyZip, setCompanyZip] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const step1Complete = companyName.trim().length > 0
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const step2Complete = fullName.trim().length > 0 && email.includes('@') && password.length >= 8
  const currentStep = !step1Complete ? 1 : !step2Complete ? 2 : 3

  const lookupDot = useCallback(async (dot: string) => {
    if (!/^\d{5,}$/.test(dot)) {
      setFmcsaData(null)
      setDotError('')
      return
    }
    setDotLoading(true)
    setDotError('')
    try {
      const res = await fetch(`/api/fmcsa?dot=${dot}`)
      if (!res.ok) {
        setDotError('DOT number not found')
        setFmcsaData(null)
        setDotLoading(false)
        return
      }
      const data: FmcsaData = await res.json()
      setFmcsaData(data)
      setCompanyName(data.dbaName || data.legalName)
      setCompanyAddress(data.phyStreet)
      setCompanyCity(data.phyCity)
      setCompanyState(data.phyState)
      setCompanyZip(data.phyZipcode)
      setCompanyPhone(data.telephone)
      setDotError('')
    } catch {
      setDotError('Failed to look up DOT number')
      setFmcsaData(null)
    } finally {
      setDotLoading(false)
    }
  }, [])

  const handleDotChange = (value: string) => {
    setDotValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setFmcsaData(null)
      setDotError('')
      return
    }
    debounceRef.current = setTimeout(() => lookupDot(value.trim()), 800)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ── Invited users: simplified form ──
  if (inviteToken) {
    return (
      <div className="flex flex-col gap-4">
        <BoxReveal boxColor="var(--skeleton)" duration={0.3}>
          <h2 className="text-3xl font-bold text-foreground">Join your team</h2>
        </BoxReveal>
        <BoxReveal boxColor="var(--skeleton)" duration={0.3} className="pb-2">
          <p className="text-sm text-muted-foreground">Create an account to accept your invitation</p>
        </BoxReveal>

        <BoxReveal boxColor="var(--skeleton)" duration={0.3} width="100%">
          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
            Create an account to accept your team invitation.
          </div>
        </BoxReveal>

        {state?.error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</div>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="invite_token" value={inviteToken} />
          <input type="hidden" name="company_name" value="Invited User" />
          <input type="hidden" name="plan" value="starter" />

          <BoxReveal boxColor="var(--skeleton)" duration={0.3} width="100%" className="space-y-2">
            <AnimatedLabel htmlFor="full_name">Full Name</AnimatedLabel>
            <AnimatedInput id="full_name" name="full_name" type="text" placeholder="John Doe" required />
          </BoxReveal>

          <BoxReveal boxColor="var(--skeleton)" duration={0.3} width="100%" className="space-y-2">
            <AnimatedLabel htmlFor="email">Email</AnimatedLabel>
            <AnimatedInput id="email" name="email" type="email" placeholder="you@company.com" required />
          </BoxReveal>

          <BoxReveal boxColor="var(--skeleton)" duration={0.3} width="100%" className="space-y-2">
            <AnimatedLabel htmlFor="password">Password</AnimatedLabel>
            <AnimatedInput id="password" name="password" type="password" minLength={8} required />
            <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
          </BoxReveal>

          <BoxReveal boxColor="var(--skeleton)" duration={0.3} width="100%" overflow="visible">
            <button
              className="group/btn relative block w-full rounded-md h-10 font-medium text-white bg-gradient-to-br from-brand to-amber-500 shadow-md hover:shadow-lg transition-shadow outline-hidden hover:cursor-pointer disabled:opacity-50"
              type="submit"
              disabled={isPending}
            >
              {isPending ? 'Creating account...' : 'Create account'} &rarr;
              <BottomGradient />
            </button>
          </BoxReveal>
        </form>

        <BoxReveal boxColor="var(--skeleton)" duration={0.3}>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href={`/login?invite_token=${inviteToken}`} className="font-medium text-brand hover:underline">Sign in</Link>
          </p>
        </BoxReveal>
      </div>
    )
  }

  // ── Regular signup: multi-step ──
  return (
    <div className="flex flex-col gap-4">
      <BoxReveal boxColor="var(--skeleton)" duration={0.3}>
        <h2 className="text-3xl font-bold text-foreground">Create your account</h2>
      </BoxReveal>
      <BoxReveal boxColor="var(--skeleton)" duration={0.3} className="pb-2">
        <p className="text-sm text-muted-foreground">Get started with VroomX in minutes</p>
      </BoxReveal>

      <BoxReveal boxColor="var(--skeleton)" duration={0.3}>
        <StepIndicator step={currentStep} total={3} />
      </BoxReveal>

      {state?.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</div>
      )}

      <form action={formAction} className="space-y-5">
        {/* ── Step 1: Company Info ── */}
        <div className="space-y-4">
          <BoxReveal boxColor="var(--skeleton)" duration={0.3}>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-wide text-foreground">Company Information</h3>
              {step1Complete && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </BoxReveal>

          <div className="space-y-2">
            <AnimatedLabel htmlFor="dot_number">USDOT Number</AnimatedLabel>
            <div className="relative">
              <AnimatedInput
                id="dot_number"
                name="dot_number"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 2033842"
                value={dotValue}
                onChange={(e) => handleDotChange(e.target.value)}
              />
              {dotLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                </div>
              )}
              {fmcsaData && !dotLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            {dotError && <p className="text-xs text-destructive">{dotError}</p>}
            {fmcsaData && (
              <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                <p className="font-medium">{fmcsaData.legalName}</p>
                {fmcsaData.dbaName && fmcsaData.dbaName !== fmcsaData.legalName && (
                  <p className="text-xs">DBA: {fmcsaData.dbaName}</p>
                )}
                <p className="text-xs">
                  {fmcsaData.phyCity}, {fmcsaData.phyState} {fmcsaData.phyZipcode}
                  {fmcsaData.mcNumber && ` — MC-${fmcsaData.mcNumber}`}
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Optional — auto-fills company info from FMCSA</p>
          </div>

          {fmcsaData?.mcNumber && <input type="hidden" name="mc_number" value={fmcsaData.mcNumber} />}

          <div className="space-y-2">
            <AnimatedLabel htmlFor="company_name">Company Name</AnimatedLabel>
            <AnimatedInput
              id="company_name"
              name="company_name"
              type="text"
              placeholder="Acme Trucking"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <AnimatedLabel htmlFor="address">Street Address</AnimatedLabel>
            <AnimatedInput
              id="address"
              name="address"
              type="text"
              placeholder="123 Main St"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-3 space-y-2">
              <AnimatedLabel htmlFor="city">City</AnimatedLabel>
              <AnimatedInput id="city" name="city" type="text" placeholder="City" value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} />
            </div>
            <div className="col-span-1 space-y-2">
              <AnimatedLabel htmlFor="state">State</AnimatedLabel>
              <AnimatedInput id="state" name="state" type="text" placeholder="TX" maxLength={2} value={companyState} onChange={(e) => setCompanyState(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-2">
              <AnimatedLabel htmlFor="zip">ZIP</AnimatedLabel>
              <AnimatedInput id="zip" name="zip" type="text" placeholder="75001" value={companyZip} onChange={(e) => setCompanyZip(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <AnimatedLabel htmlFor="phone">Phone</AnimatedLabel>
            <AnimatedInput id="phone" name="phone" type="tel" placeholder="(555) 123-4567" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
          </div>
        </div>

        {/* ── Step 2: Account Details ── */}
        <RevealSection show={step1Complete}>
          <div className="space-y-4 pt-2">
            <div className="border-t border-border-subtle pt-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold tracking-wide text-foreground">Account Details</h3>
                {step2Complete && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <AnimatedLabel htmlFor="full_name">Full Name</AnimatedLabel>
                  <AnimatedInput id="full_name" name="full_name" type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <AnimatedLabel htmlFor="email">Email</AnimatedLabel>
                  <AnimatedInput id="email" name="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <AnimatedLabel htmlFor="password">Password</AnimatedLabel>
                  <div className="relative">
                    <AnimatedInput
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
                </div>
              </div>
            </div>
          </div>
        </RevealSection>

        {/* ── Step 3: Plan Selection ── */}
        <RevealSection show={step1Complete && step2Complete}>
          <div className="space-y-4 pt-2">
            <div className="border-t border-border-subtle pt-4">
              <h3 className="text-sm font-semibold tracking-wide text-foreground mb-4">Select Plan</h3>
              <div className="grid gap-3">
                {(['starter', 'pro', 'enterprise'] as Plan[]).map((plan) => (
                  <label
                    key={plan}
                    className={`relative flex cursor-pointer rounded-lg border p-4 transition-all ${
                      selectedPlan === plan
                        ? 'border-brand bg-brand/5 shadow-sm'
                        : 'border-border-subtle hover:border-brand/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={plan}
                      checked={selectedPlan === plan}
                      onChange={(e) => setSelectedPlan(e.target.value as Plan)}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between">
                        <p className="font-medium">{PLAN_INFO[plan].name}</p>
                        <p className="text-lg font-bold">
                          ${TIER_PRICING[plan]}
                          <span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">{PLAN_INFO[plan].description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                All plans include a 14-day free trial. No charge until trial ends.
              </p>
            </div>

            <button
              className="group/btn relative block w-full rounded-md h-10 font-medium text-white bg-gradient-to-br from-brand to-amber-500 shadow-md hover:shadow-lg transition-shadow outline-hidden hover:cursor-pointer disabled:opacity-50"
              type="submit"
              disabled={isPending}
            >
              {isPending ? 'Creating account...' : 'Create account'} &rarr;
              <BottomGradient />
            </button>
          </div>
        </RevealSection>
      </form>

      <BoxReveal boxColor="var(--skeleton)" duration={0.3}>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
        </p>
      </BoxReveal>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
