'use client'

import { useState } from 'react'
import { AlertTriangle, Check, Clock, CreditCard, HelpCircle, Mail, Phone, Star, Truck, Users, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLAN_DEFINITIONS, type PlanDefinition } from '@/lib/data/plan-features'
import { createBillingPortalSession, createCheckoutSession } from '@/app/actions/billing'
import { TIER_LIMITS, type SubscriptionPlan } from '@/types'
import { getTierDisplayName, getStatusBadgeColor } from '@/lib/tier'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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

  const config: Record<string, { icon: React.ReactNode; borderColor: string; bg: string; text: string; label: string; message: string }> = {
    trialing: {
      icon: <Clock className="h-5 w-5 shrink-0 text-blue-500" />,
      borderColor: 'border-l-blue-500',
      bg: 'bg-blue-500/5',
      text: 'text-blue-700',
      label: 'Trial Active',
      message: 'You are on a free trial. Choose a plan below to continue after your trial ends.',
    },
    past_due: {
      icon: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />,
      borderColor: 'border-l-amber-500',
      bg: 'bg-amber-500/5',
      text: 'text-amber-700',
      label: 'Payment Past Due',
      message: gracePeriodEndsAt
        ? `Your payment is past due. Please update your payment method before ${new Date(gracePeriodEndsAt).toLocaleDateString()} to avoid service interruption.`
        : 'Your payment is past due. Please update your payment method to avoid service interruption.',
    },
    canceled: {
      icon: <XCircle className="h-5 w-5 shrink-0 text-red-500" />,
      borderColor: 'border-l-red-500',
      bg: 'bg-red-500/5',
      text: 'text-red-700',
      label: 'Subscription Canceled',
      message: 'Your subscription has been canceled. Resubscribe below to restore access.',
    },
    unpaid: {
      icon: <XCircle className="h-5 w-5 shrink-0 text-red-500" />,
      borderColor: 'border-l-red-500',
      bg: 'bg-red-500/5',
      text: 'text-red-700',
      label: 'Unpaid Balance',
      message: 'Your account has an unpaid balance. Please update your payment method.',
    },
  }

  const c = config[subscriptionStatus]
  if (!c) return null

  return (
    <Card className={cn('border-l-4 shadow-none', c.borderColor, c.bg, 'border-border-subtle')}>
      <CardContent className="flex items-start gap-3 px-6 py-4">
        {c.icon}
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold', c.text)}>{c.label}</p>
          <p className={cn('mt-0.5 text-sm', c.text, 'opacity-80')}>{c.message}</p>
        </div>
      </CardContent>
    </Card>
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
              ? 'bg-surface text-foreground shadow-sm'
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
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Yearly
        </button>
      </div>
      {isYearly && (
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
          Save 20%
        </span>
      )}
    </div>
  )
}

// ─── Plan Card ───────────────────────────────────────────────────────────────

const PLAN_ACCENT: Record<string, { topBorder: string; ring: string; bg: string; badgeBg: string; badgeText: string; btnClass: string }> = {
  owner_operator: {
    topBorder: 'border-t-emerald-500',
    ring: 'ring-2 ring-emerald-500/40 shadow-emerald-500/10 shadow-lg',
    bg: 'bg-emerald-500/5',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    btnClass: 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  },
  starter_x: {
    topBorder: 'border-t-brand',
    ring: 'ring-2 ring-brand/40 shadow-brand/10 shadow-lg',
    bg: 'bg-brand/5',
    badgeBg: 'bg-brand/10',
    badgeText: 'text-brand',
    btnClass: 'bg-brand text-white hover:bg-brand/90',
  },
  pro_x: {
    topBorder: 'border-t-blue-500',
    ring: 'ring-2 ring-blue-500/40 shadow-blue-500/10 shadow-lg',
    bg: 'bg-blue-500/5',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    btnClass: 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
  },
}

function PlanCard({
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
  const accent = PLAN_ACCENT[plan.key] ?? PLAN_ACCENT.starter_x

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border-t-4 border border-border-subtle bg-surface p-5 transition-all duration-200',
        accent.topBorder,
        isCurrent ? [accent.ring, accent.bg] : 'hover:shadow-md hover:bg-surface-raised/40'
      )}
    >
      {/* Current plan indicator */}
      {isCurrent && (
        <div className="absolute -top-px right-4">
          <span className={cn('inline-flex items-center rounded-b-md px-2.5 py-0.5 text-[11px] font-semibold', accent.badgeBg, accent.badgeText)}>
            Current Plan
          </span>
        </div>
      )}

      {/* Popular badge */}
      {plan.popular && !isCurrent && (
        <div className="absolute -top-px right-4">
          <span className="inline-flex items-center gap-1 rounded-b-md bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
            <Star className="h-3 w-3 fill-current" />
            Popular
          </span>
        </div>
      )}

      {/* Plan name */}
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{plan.name}</p>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums text-foreground">${price}</span>
          <span className="text-sm text-muted-foreground">/{isYearly ? 'yr' : 'mo'}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {plan.limits.trucks === 1 && plan.limits.users === 1
            ? '1 truck · 1 user'
            : `${plan.limits.trucks} trucks · ${plan.limits.users} users`}
        </p>
      </div>

      {/* Divider */}
      <div className="my-3 border-t border-border-subtle" />

      {/* Features */}
      <ul className="mb-4 flex-1 space-y-1.5">
        {plan.includes.map((item, i) => (
          <li key={i} className={cn('flex items-start gap-2 text-xs', i === 0 ? 'font-semibold text-muted-foreground' : 'text-foreground/80')}>
            {i > 0 && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />}
            {item}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={() => onAction(plan)}
        disabled={buttonConfig.disabled || isLoading}
        className={cn(
          'mt-auto w-full rounded-lg px-4 py-2 text-sm font-medium transition-all',
          buttonConfig.variant === 'upgrade' && 'bg-brand text-white hover:bg-brand/90',
          buttonConfig.variant === 'outline' && accent.btnClass,
          buttonConfig.variant === 'current' && cn('cursor-default', accent.btnClass),
          (buttonConfig.disabled || isLoading) && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isLoading ? 'Redirecting...' : buttonConfig.text}
      </button>
    </div>
  )
}

// ─── Trial Countdown ─────────────────────────────────────────────────────────

function TrialCountdown({ trialEndsAt }: { trialEndsAt: string }) {
  const endDate = new Date(trialEndsAt)
  const now = new Date()
  const totalDays = 14
  const msRemaining = endDate.getTime() - now.getTime()
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))
  const progress = Math.max(0, Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100))

  let barColor = 'bg-emerald-500'
  let textColor = 'text-emerald-600'
  let urgencyBg = 'bg-emerald-500/10'
  if (daysRemaining <= 3) {
    barColor = 'bg-red-500'
    textColor = 'text-red-600'
    urgencyBg = 'bg-red-500/10'
  } else if (daysRemaining <= 7) {
    barColor = 'bg-amber-500'
    textColor = 'text-amber-600'
    urgencyBg = 'bg-amber-500/10'
  }

  return (
    <div className={cn('rounded-lg p-3 space-y-2', urgencyBg)}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Trial period
        </span>
        <span className={cn('text-sm font-bold tabular-nums', textColor)}>
          {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
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

// ─── Usage Meters ────────────────────────────────────────────────────────────

function getBarColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 70) return 'bg-amber-500'
  return 'bg-brand'
}

function UsageMeters({ plan, truckCount, userCount }: { plan: string; truckCount: number; userCount: number }) {
  const limits = TIER_LIMITS[plan as SubscriptionPlan] ?? TIER_LIMITS.owner_operator

  const meters = [
    {
      label: 'Trucks',
      icon: <Truck className="h-4 w-4 text-blue-500" />,
      iconBg: 'bg-blue-100',
      current: truckCount,
      limit: limits.trucks,
    },
    {
      label: 'Team Members',
      icon: <Users className="h-4 w-4 text-violet-500" />,
      iconBg: 'bg-violet-100',
      current: userCount,
      limit: limits.users,
    },
  ]

  return (
    <div className="space-y-2.5">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usage</h4>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {meters.map((m) => {
          const percent = Math.min((m.current / m.limit) * 100, 100)

          return (
            <div key={m.label} className="rounded-lg border border-border-subtle bg-secondary/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', m.iconBg)}>
                    {m.icon}
                  </span>
                  {m.label}
                </span>
                <span className="text-xs font-semibold tabular-nums text-foreground">
                  {m.current}
                  <span className="text-muted-foreground font-normal">{' '}/ {m.limit}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', getBarColor(percent))}
                  style={{ width: `${Math.max(percent, 2)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
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
    <Card className="border-border-subtle bg-secondary/20">
      <CardHeader className="px-6 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </span>
          Frequently Asked Questions
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pt-0">
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-border-subtle">
              <AccordionTrigger className="text-sm hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
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
  const effectivePlan = currentPlan

  async function handlePlanAction(plan: PlanDefinition) {
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

    const planOrder: SubscriptionPlan[] = ['owner_operator', 'starter_x', 'pro_x']
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
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-brand/10 p-2">
          <CreditCard className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Plan &amp; Billing</h2>
          <p className="text-sm text-muted-foreground">Manage your subscription, usage, and billing details</p>
        </div>
      </div>

      {/* Status Banner */}
      <StatusBanner subscriptionStatus={subscriptionStatus} gracePeriodEndsAt={gracePeriodEndsAt} />

      {/* Plan Selection Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Choose a Plan</h3>
          <p className="text-xs text-muted-foreground">Switch or upgrade your plan at any time</p>
        </div>
        <BillingToggle isYearly={isYearly} onToggle={setIsYearly} />
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLAN_DEFINITIONS.map((plan) => {
          const isCurrent = plan.key === effectivePlan
          const btnConfig = getButtonConfig(plan)
          return (
            <PlanCard
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
      </div>

      {/* Current Billing + Usage */}
      <Card className="border-border-subtle">
        <CardHeader className="px-6 pb-4 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Current Billing</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{statusLabel}</span>
              <Badge className={cn('text-[11px] font-medium', statusBadge)}>
                {subscriptionStatus === 'active' ? 'Active' : subscriptionStatus === 'trialing' ? 'Trial' : subscriptionStatus.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pt-5 space-y-5">
          {/* Trial countdown */}
          {isTrialing && trialEndsAt && (
            <TrialCountdown trialEndsAt={trialEndsAt} />
          )}

          {/* Usage meters */}
          <UsageMeters plan={currentPlan} truckCount={truckCount} userCount={userCount} />

          {/* Manage Billing button */}
          {hasStripeCustomer && (
            <Button
              onClick={() => createBillingPortalSession()}
              className="w-full"
            >
              Manage Billing
            </Button>
          )}
        </CardContent>
      </Card>

      {/* FAQ */}
      <BillingFaq />

      {/* Support */}
      <SupportContactLine />
    </div>
  )
}
