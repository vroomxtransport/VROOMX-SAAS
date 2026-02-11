'use client'

import { signUpAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TIER_LIMITS, TIER_PRICING } from '@/types'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

type Plan = 'starter' | 'pro' | 'enterprise'

const PLAN_INFO: Record<Plan, { name: string; description: string }> = {
  starter: { name: 'Starter', description: `Up to ${TIER_LIMITS.starter.trucks} trucks` },
  pro: { name: 'Pro', description: `Up to ${TIER_LIMITS.pro.trucks} trucks` },
  enterprise: { name: 'Enterprise', description: 'Unlimited trucks' },
}

export default function SignupPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [selectedPlan, setSelectedPlan] = useState<Plan>('starter')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true)
    await signUpAction(formData)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">VroomX</CardTitle>
        <CardDescription>Create your account</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              placeholder="John Doe"
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
              required
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              name="company_name"
              type="text"
              placeholder="Acme Trucking"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Select Plan</Label>
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
            <p className="text-xs text-muted-foreground">
              All plans include a 14-day free trial
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Continue to checkout'}
          </Button>
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
