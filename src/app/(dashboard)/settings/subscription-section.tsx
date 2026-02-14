'use client'

import { useState } from 'react'
import { AlertTriangle, Clock, XCircle, Truck, Users, Star, Mail, Phone, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLAN_DEFINITIONS, type PlanDefinition } from '@/lib/data/plan-features'
import { createBillingPortalSession, createCheckoutSession } from '@/app/actions/billing'
import { TIER_LIMITS, type SubscriptionPlan } from '@/types'
import { getTierDisplayName, getStatusBadgeColor } from '@/lib/tier'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'

interface SubscriptionSectionProps {
  currentPlan: string
  subscriptionStatus: string
  hasStripeCustomer: boolean
  gracePeriodEndsAt?: string | null
  trialEndsAt?: string | null
  truckCount: number
  userCount: number
}

// ─── Status Banner ───────────────────────────────────────────────────────────

function StatusBanner({ subscriptionStatus, gracePeriodEndsAt }: { subscriptionStatus: string; gracePeriodEndsAt?: string | null }) {
  if (subscriptionStatus === 'active') return null

  const config: Record<string, { icon: React.ReactNode; bg: string; border: string; text: string; message: string }> = {
    trialing: {
      icon: <Clock className="h-5 w-5 shrink-0 text-blue-500" />,
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      text: 'text-blue-700 dark:text-blue-300',
      message: 'You are on a free trial. Choose a plan below to continue after your trial ends.',
    },
    past_due: {
      icon: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />,
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      text: 'text-amber-700 dark:text-amber-300',
      message: gracePeriodEndsAt
        ? `Your payment is past due. Please update your payment method before ${new Date(gracePeriodEndsAt).toLocaleDateString()} to avoid service interruption.`
        : 'Your payment is past due. Please update your payment method to avoid service interruption.',
    },
    canceled: {
      icon: <XCircle className="h-5 w-5 shrink-0 text-red-500" />,
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      text: 'text-red-700 dark:text-red-300',
      message: 'Your subscription has been canceled. Resubscribe below to restore access.',
    },
    unpaid: {
      icon: <XCircle className="h-5 w-5 shrink-0 text-red-500" />,
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      text: 'text-red-700 dark:text-red-300',
      message: 'Your account has an unpaid balance. Please update your payment method.',
    },
  }

  const c = config[subscriptionStatus]
  if (!c) return null

  return (
    <div className={`flex items-start gap-3 rounded-xl border ${c.border} ${c.bg} p-4`}>
      {c.icon}
      <p className={`text-sm font-medium ${c.text}`}>{c.message}</p>
    </div>
  )
}

// ─── Billing Toggle ──────────────────────────────────────────────────────────

function BillingToggle({ isYearly, onToggle }: { isYearly: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex rounded-lg border border-border-subtle bg-secondary p-1">
        <button
          onClick={() => onToggle(false)}
          className={cn(
            'relative z-10 rounded-md px-4 py-1.5 text-sm font-medium transition-all',
            !isYearly
              ? 'bg-white text-foreground shadow-sm dark:bg-surface-raised'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Monthly
        </button>
        <button
          onClick={() => onToggle(true)}
          className={cn(
            'relative z-10 rounded-md px-4 py-1.5 text-sm font-medium transition-all',
            isYearly
              ? 'bg-white text-foreground shadow-sm dark:bg-surface-raised'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Yearly
        </button>
      </div>
      {isYearly && (
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          Save 20%
        </span>
      )}
    </div>
  )
}

// ─── Plan Row ────────────────────────────────────────────────────────────────

function PlanRow({
  plan,
  isCurrent,
  isYearly,
  loading,
  onAction,
  buttonConfig,
}: {
  plan: PlanDefinition
  isCurrent: boolean
  isYearly: boolean
  loading: string | null
  onAction: (plan: PlanDefinition) => void
  buttonConfig: { text: string; disabled: boolean; variant: string }
}) {
  const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice
  const isLoading = loading === plan.key
  const isUnlimited = plan.limits.trucks === Infinity

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between',
        isCurrent
          ? 'border-l-2 border-l-brand border-y-brand/20 border-r-brand/20 bg-brand/5'
          : 'border-border-subtle hover:bg-surface-raised/50'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{plan.name}</span>
            {plan.popular && (
              <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                <Star className="h-3 w-3" />
                Popular
              </span>
            )}
            {isCurrent && (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                Current
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isUnlimited ? 'Unlimited trucks & users' : `${plan.limits.trucks} trucks, ${plan.limits.users} users`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="text-right">
          <span className="text-lg font-bold tabular-nums text-foreground">${price}</span>
          <span className="text-xs text-muted-foreground">/{isYearly ? 'yr' : 'mo'}</span>
        </div>

        <button
          onClick={() => onAction(plan)}
          disabled={buttonConfig.disabled || isLoading}
          className={cn(
            'shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all',
            buttonConfig.variant === 'upgrade' && 'bg-brand text-white hover:bg-brand/90',
            buttonConfig.variant === 'outline' && 'border border-border-subtle bg-transparent text-foreground hover:bg-surface-raised',
            buttonConfig.variant === 'current' && 'cursor-default border border-brand/20 bg-brand/5 text-brand',
            (buttonConfig.disabled || isLoading) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isLoading ? 'Redirecting...' : buttonConfig.text}
        </button>
      </div>
    </div>
  )
}

// ─── Trial Countdown ─────────────────────────────────────────────────────────

function TrialCountdown({ trialEndsAt }: { trialEndsAt: string }) {
  const endDate = new Date(trialEndsAt)
  const now = new Date()
  const totalDays = 14 // typical trial length
  const msRemaining = endDate.getTime() - now.getTime()
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))
  const progress = Math.max(0, Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100))

  let barColor = 'bg-brand'
  let textColor = 'text-brand'
  if (daysRemaining <= 3) {
    barColor = 'bg-red-500'
    textColor = 'text-red-500'
  } else if (daysRemaining <= 7) {
    barColor = 'bg-amber-500'
    textColor = 'text-amber-500'
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Trial ends</span>
        <span className={cn('text-xs font-semibold tabular-nums', textColor)}>
          {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Ends {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
    </div>
  )
}

// ─── Usage Meters (inline) ───────────────────────────────────────────────────

function getBarColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 70) return 'bg-amber-500'
  return 'bg-brand'
}

function UsageMeters({ plan, truckCount, userCount }: { plan: string; truckCount: number; userCount: number }) {
  const tierKey = (plan === 'trial' ? 'starter' : plan) as SubscriptionPlan
  const limits = TIER_LIMITS[tierKey] || TIER_LIMITS.starter
  const truckLimit = limits.trucks === Infinity ? -1 : limits.trucks
  const userLimit = limits.users === Infinity ? -1 : limits.users

  const meters = [
    { label: 'Trucks', icon: <Truck className="h-3.5 w-3.5 text-muted-foreground" />, current: truckCount, limit: truckLimit },
    { label: 'Users', icon: <Users className="h-3.5 w-3.5 text-muted-foreground" />, current: userCount, limit: userLimit },
  ]

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usage</h4>
      {meters.map((m) => {
        const isUnlimited = m.limit === -1
        const percent = isUnlimited ? 0 : Math.min((m.current / m.limit) * 100, 100)

        return (
          <div key={m.label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {m.icon}
                {m.label}
              </span>
              <span className="text-xs font-medium tabular-nums text-foreground">
                {m.current} / {isUnlimited ? '\u221E' : m.limit}
              </span>
            </div>
            {!isUnlimited && (
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', getBarColor(percent))}
                  style={{ width: `${Math.max(percent, 2)}%` }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Billing FAQ ─────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    question: 'How do we count active trucks?',
    answer: 'Active trucks are any trucks in your fleet with an "active" status. Trucks marked as inactive or in maintenance do not count toward your plan limit.',
  },
  {
    question: 'When do we bill?',
    answer: 'Billing occurs on the same date each month (or year for annual plans) from when you first subscribed. You can view your next billing date in the Stripe billing portal.',
  },
  {
    question: 'How does proration work?',
    answer: 'When you upgrade mid-cycle, you are charged the prorated difference for the remaining time. When you downgrade, the credit is applied to your next invoice.',
  },
  {
    question: 'Where can I find my receipts?',
    answer: 'All invoices and receipts are available in the Stripe billing portal. Click "Manage Billing" above to access your full payment history.',
  },
]

function BillingFaq() {
  return (
    <Card className="border-border-subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          Frequently Asked Questions
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-border-subtle">
              <AccordionTrigger className="text-sm hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}

// ─── Support Contact Line ────────────────────────────────────────────────────

function SupportContactLine() {
  return (
    <p className="text-center text-xs text-muted-foreground">
      Need help?{' '}
      <a href="mailto:support@vroomx.com" className="inline-flex items-center gap-1 text-brand hover:underline">
        <Mail className="h-3 w-3" />
        support@vroomx.com
      </a>
      {' or '}
      <a href="tel:+18005551234" className="inline-flex items-center gap-1 text-brand hover:underline">
        <Phone className="h-3 w-3" />
        (800) 555-1234
      </a>
    </p>
  )
}

// ─── Main Section ────────────────────────────────────────────────────────────

export function SubscriptionSection({ currentPlan, subscriptionStatus, hasStripeCustomer, gracePeriodEndsAt, trialEndsAt, truckCount, userCount }: SubscriptionSectionProps) {
  const [isYearly, setIsYearly] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const effectivePlan = currentPlan === 'trial' ? 'starter' : currentPlan

  async function handlePlanAction(plan: PlanDefinition) {
    if (plan.key === 'enterprise') {
      window.location.href = 'mailto:sales@vroomx.com?subject=Enterprise%20Plan%20Inquiry'
      return
    }
    if (plan.key === effectivePlan) return

    setLoading(plan.key)
    try {
      if (hasStripeCustomer) {
        await createBillingPortalSession()
      } else {
        await createCheckoutSession(plan.key)
      }
    } catch {
      // redirect throws, caught by Next.js
    }
    setLoading(null)
  }

  function getButtonConfig(plan: PlanDefinition) {
    const isCurrent = plan.key === effectivePlan
    if (isCurrent) return { text: 'Current Plan', disabled: true, variant: 'current' as const }
    if (plan.key === 'enterprise') return { text: 'Contact Sales', disabled: false, variant: 'outline' as const }

    const planOrder: SubscriptionPlan[] = ['starter', 'pro', 'enterprise']
    const currentIdx = planOrder.indexOf(effectivePlan as SubscriptionPlan)
    const targetIdx = planOrder.indexOf(plan.key)
    if (targetIdx > currentIdx) return { text: 'Upgrade', disabled: false, variant: 'upgrade' as const }
    return { text: 'Downgrade', disabled: false, variant: 'outline' as const }
  }

  const isTrialing = subscriptionStatus === 'trialing'
  const statusLabel = getTierDisplayName(currentPlan)
  const statusBadge = getStatusBadgeColor(subscriptionStatus)

  return (
    <div className="space-y-6">
      <StatusBanner subscriptionStatus={subscriptionStatus} gracePeriodEndsAt={gracePeriodEndsAt} />

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Plans Card */}
        <Card className="border-border-subtle lg:col-span-3">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Choose a Plan</CardTitle>
              <BillingToggle isYearly={isYearly} onToggle={setIsYearly} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {PLAN_DEFINITIONS.map((plan) => {
              const isCurrent = plan.key === effectivePlan
              const btnConfig = getButtonConfig(plan)
              return (
                <PlanRow
                  key={plan.key}
                  plan={plan}
                  isCurrent={isCurrent}
                  isYearly={isYearly}
                  loading={loading}
                  onAction={handlePlanAction}
                  buttonConfig={btnConfig}
                />
              )
            })}
          </CardContent>
        </Card>

        {/* Current Billing Card */}
        <Card className="border-border-subtle lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Current Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{statusLabel}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', statusBadge)}>
                  {subscriptionStatus === 'active' ? 'Active' : subscriptionStatus === 'trialing' ? 'Trial' : subscriptionStatus.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Trial countdown */}
            {isTrialing && trialEndsAt && (
              <TrialCountdown trialEndsAt={trialEndsAt} />
            )}

            {/* Divider */}
            <div className="border-t border-border-subtle" />

            {/* Usage */}
            <UsageMeters plan={currentPlan} truckCount={truckCount} userCount={userCount} />

            {/* Manage Billing button */}
            {hasStripeCustomer && (
              <button
                onClick={() => createBillingPortalSession()}
                className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand/90"
              >
                Manage Billing
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FAQ */}
      <BillingFaq />

      {/* Support */}
      <SupportContactLine />
    </div>
  )
}
