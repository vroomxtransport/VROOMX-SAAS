'use client'

import { createBillingPortalSession } from '@/app/actions/billing'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getTierDisplayName, getStatusBadgeColor } from '@/lib/tier'
import { TIER_PRICING, type SubscriptionPlan } from '@/types'
import { CreditCard } from 'lucide-react'
import { useState } from 'react'

interface BillingSectionProps {
  plan: string
  subscriptionStatus: string
  hasStripeCustomer: boolean
}

export function BillingSection({ plan, subscriptionStatus, hasStripeCustomer }: BillingSectionProps) {
  const [loading, setLoading] = useState(false)

  async function handleManageSubscription() {
    setLoading(true)
    try {
      await createBillingPortalSession()
    } catch {
      // redirect throws, which is caught by Next.js
    }
    setLoading(false)
  }

  const planKey = plan as SubscriptionPlan
  const price = TIER_PRICING[planKey]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Billing
        </CardTitle>
        <CardDescription>Manage your subscription and payment method.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Current Plan</span>
          <span className="font-medium">{getTierDisplayName(plan)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Status</span>
          <Badge className={getStatusBadgeColor(subscriptionStatus)}>
            {subscriptionStatus}
          </Badge>
        </div>

        {price && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Monthly Price</span>
            <span className="font-medium">${price}/mo</span>
          </div>
        )}

        {hasStripeCustomer && (
          <Button
            onClick={handleManageSubscription}
            disabled={loading}
            className="w-full"
            variant="outline"
          >
            {loading ? 'Opening...' : 'Manage Subscription'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
