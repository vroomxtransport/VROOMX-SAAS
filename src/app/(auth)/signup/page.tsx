'use client'

import { signUpAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TIER_LIMITS, TIER_PRICING } from '@/types'
import Link from 'next/link'
import { useActionState, useState, useRef, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

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
      <div className="overflow-hidden">
        {children}
      </div>
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
                ? 'bg-primary text-primary-foreground'
                : i + 1 === step
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
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
                i + 1 < step ? 'bg-primary' : 'bg-muted'
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

  // Step 1 complete: company name is filled
  const step1Complete = companyName.trim().length > 0

  // Step 2 tracking
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

  // Invited users get a simple form (no steps)
  if (inviteToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">VroomX</CardTitle>
          <CardDescription>Create an account to accept your team invitation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
            Create an account to accept your team invitation.
          </div>
          {state?.error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="invite_token" value={inviteToken} />
            <input type="hidden" name="company_name" value="Invited User" />
            <input type="hidden" name="plan" value="starter" />
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" name="full_name" type="text" placeholder="John Doe" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@company.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
              <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href={`/login?invite_token=${inviteToken}`} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">VroomX</CardTitle>
        <CardDescription>Create your account</CardDescription>
        <StepIndicator step={currentStep} total={3} />
      </CardHeader>
      <CardContent>
        {state?.error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
        <form action={formAction} className="space-y-5">
          {/* ── Step 1: Company Info ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-wide text-foreground">Company Information</h3>
              {step1Complete && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dot_number">USDOT Number</Label>
              <div className="relative">
                <Input
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
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                )}
                {fmcsaData && !dotLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              {dotError && <p className="text-xs text-destructive">{dotError}</p>}
              {fmcsaData && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-300">
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
              <p className="text-xs text-muted-foreground">
                Optional — auto-fills company info from FMCSA
              </p>
            </div>

            {fmcsaData?.mcNumber && (
              <input type="hidden" name="mc_number" value={fmcsaData.mcNumber} />
            )}

            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
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
              <Label htmlFor="address">Street Address</Label>
              <Input
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
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  type="text"
                  placeholder="City"
                  value={companyCity}
                  onChange={(e) => setCompanyCity(e.target.value)}
                />
              </div>
              <div className="col-span-1 space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  name="state"
                  type="text"
                  placeholder="TX"
                  maxLength={2}
                  value={companyState}
                  onChange={(e) => setCompanyState(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="zip">ZIP</Label>
                <Input
                  id="zip"
                  name="zip"
                  type="text"
                  placeholder="75001"
                  value={companyZip}
                  onChange={(e) => setCompanyZip(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
              />
            </div>
          </div>

          {/* ── Step 2: Account Details (reveal after company name filled) ── */}
          <RevealSection show={step1Complete}>
            <div className="space-y-4 pt-2">
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-sm font-semibold tracking-wide text-foreground">Account Details</h3>
                  {step2Complete && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      name="full_name"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
                  </div>
                </div>
              </div>
            </div>
          </RevealSection>

          {/* ── Step 3: Select Plan (reveal after account details filled) ── */}
          <RevealSection show={step1Complete && step2Complete}>
            <div className="space-y-4 pt-2">
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold tracking-wide text-foreground mb-4">Select Plan</h3>
                <div className="grid gap-3">
                  {(['starter', 'pro', 'enterprise'] as Plan[]).map((plan) => (
                    <label
                      key={plan}
                      className={`relative flex cursor-pointer rounded-lg border p-4 transition-colors ${
                        selectedPlan === plan
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
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
                        <p className="text-sm text-muted-foreground">
                          {PLAN_INFO[plan].description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  All plans include a 14-day free trial. No charge until trial ends.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Creating account...' : 'Create account'}
              </Button>
            </div>
          </RevealSection>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
