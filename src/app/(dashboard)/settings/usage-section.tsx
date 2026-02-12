import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TIER_LIMITS, type SubscriptionPlan } from '@/types'
import { BarChart3 } from 'lucide-react'

interface UsageSectionProps {
  plan: string
  truckCount: number
  userCount: number
}

export function UsageSection({ plan, truckCount, userCount }: UsageSectionProps) {
  const tierKey = (plan === 'trial' ? 'starter' : plan) as SubscriptionPlan
  const limits = TIER_LIMITS[tierKey] || TIER_LIMITS.starter

  const truckLimit = limits.trucks === Infinity ? -1 : limits.trucks
  const userLimit = limits.users === Infinity ? -1 : limits.users

  const truckPercent = truckLimit === -1 ? 0 : Math.min((truckCount / truckLimit) * 100, 100)
  const userPercent = userLimit === -1 ? 0 : Math.min((userCount / userLimit) * 100, 100)

  function getBarColor(percent: number): string {
    if (percent >= 90) return 'bg-red-500'
    if (percent >= 70) return 'bg-amber-500'
    return 'bg-blue-500'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Usage
        </CardTitle>
        <CardDescription>Current resource usage against your plan limits.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trucks */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Trucks</span>
            <span className="font-medium">
              {truckCount} / {truckLimit === -1 ? 'Unlimited' : truckLimit}
            </span>
          </div>
          {truckLimit !== -1 && (
            <div className="h-2 rounded-full bg-gray-100">
              <div
                className={`h-2 rounded-full transition-all ${getBarColor(truckPercent)}`}
                style={{ width: `${truckPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Users */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Team Members</span>
            <span className="font-medium">
              {userCount} / {userLimit === -1 ? 'Unlimited' : userLimit}
            </span>
          </div>
          {userLimit !== -1 && (
            <div className="h-2 rounded-full bg-gray-100">
              <div
                className={`h-2 rounded-full transition-all ${getBarColor(userPercent)}`}
                style={{ width: `${userPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Upgrade CTA for non-enterprise plans */}
        {plan !== 'enterprise' && (truckPercent >= 70 || userPercent >= 70) && (
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-sm text-blue-900">
              Approaching your plan limits.{' '}
              <a href="/settings" className="font-medium underline">Upgrade your plan</a> for more capacity.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
