# Phase 5: Onboarding + Stripe Polish - Research

**Researched:** 2026-02-12
**Domain:** Team invites, Stripe Billing Portal, webhook hardening, tier enforcement, onboarding UX
**Confidence:** HIGH (existing codebase extensively verified; Stripe docs confirmed)

## Summary

Phase 5 builds on substantial existing infrastructure from Phase 1 (Stripe webhooks, idempotency, subscription lifecycle) and Phase 4 (Resend email delivery). The primary work falls into five distinct areas: (1) team member invite flow, (2) Stripe Billing Portal integration for self-service plan management, (3) expanding webhook coverage and adding dunning/grace period logic, (4) tier-based limit enforcement at both Server Action and database levels, and (5) a guided onboarding wizard for first-time setup.

The codebase already has: webhook route at `/api/webhooks/stripe` with signature verification and idempotency via `stripe_events` table, four event handlers (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`), bidirectional PRICE_MAP, service role client pattern, tenant_memberships table with role support, JWT custom claims hook injecting `tenant_id`/`role`/`plan`/`subscription_status`, Resend email client, and React Email templates. Phase 5 extends these, not rebuilds them.

**Primary recommendation:** Build in this order: (1) DB schema additions (invites table, tenant limit columns, grace period columns), (2) tier limit enforcement in Server Actions + DB triggers, (3) Stripe Billing Portal API route + settings page, (4) expanded webhook handlers + dunning flow, (5) team invite flow with email, (6) onboarding wizard, (7) usage dashboard.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | ^20.3.1 | Stripe API (billing portal, subscriptions) | Already in use; `billingPortal.sessions.create` for portal |
| @supabase/supabase-js | ^2.95.3 | Supabase client (admin API for invites) | Already in use; `auth.admin.inviteUserByEmail` for invites |
| resend | ^6.9.2 | Transactional email delivery | Already in use for invoice emails; reuse for invite emails |
| @react-email/components | ^1.0.7 | React-based email templates | Already in use for invoice email template |
| react-hook-form | ^7.71.1 | Form state management | Already in use across all CRUD forms |
| zod | ^4.3.6 | Schema validation | Already in use for all Server Action inputs |
| sonner | ^2.0.7 | Toast notifications | Already in use from Phase 4 |

### Supporting (Already Installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.563.0 | Icons | Step indicators, status icons in wizard |
| date-fns | ^4.1.0 | Date formatting | Grace period calculations, trial end display |
| zustand | ^5.0.11 | Client state | Wizard step state (if needed) |

### No New Dependencies Required

This phase requires **zero new npm packages**. All functionality can be built with existing libraries:

- Stripe Billing Portal: `stripe.billingPortal.sessions.create()` (already in stripe package)
- Team invites: Supabase admin API + Resend (both installed)
- Onboarding wizard: Custom stepper using existing shadcn/ui components
- Tier enforcement: Server Action logic + Supabase queries (no library needed)

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── webhooks/stripe/route.ts          # EXTEND: add new event handlers
│   │   └── billing-portal/route.ts           # NEW: create portal session
│   ├── (auth)/
│   │   └── invite/accept/route.ts            # NEW: handle invite acceptance
│   ├── (dashboard)/
│   │   ├── settings/
│   │   │   ├── page.tsx                      # NEW: settings page (billing + team)
│   │   │   ├── billing-section.tsx           # NEW: plan info + portal link
│   │   │   ├── team-section.tsx              # NEW: team members + invite form
│   │   │   └── usage-section.tsx             # NEW: usage dashboard
│   │   └── onboarding/
│   │       └── page.tsx                      # NEW: guided setup wizard
│   ├── actions/
│   │   ├── billing.ts                        # NEW: billing portal server action
│   │   ├── invites.ts                        # NEW: team invite server actions
│   │   └── trucks.ts                         # EXTEND: add tier limit check
│   │   └── drivers.ts                        # EXTEND: add tier limit check (users)
│   │   └── ...                               # Other entity actions: add limit checks
├── lib/
│   ├── stripe/
│   │   ├── config.ts                         # EXISTS: no changes needed
│   │   ├── webhook-handlers.ts               # EXTEND: add dunning + trial handlers
│   │   └── billing-portal.ts                 # NEW: portal session creation helper
│   ├── tier.ts                               # EXTEND: add limit checking functions
│   └── resend/
│       └── client.ts                         # EXISTS: no changes needed
├── components/
│   ├── email/
│   │   ├── invoice-email.tsx                 # EXISTS
│   │   └── invite-email.tsx                  # NEW: team invite email template
│   └── onboarding/
│       ├── onboarding-wizard.tsx             # NEW: multi-step wizard container
│       ├── step-driver.tsx                   # NEW: add first driver step
│       ├── step-truck.tsx                    # NEW: add first truck step
│       └── step-order.tsx                    # NEW: create first order step
├── db/
│   └── schema.ts                             # EXTEND: invites table, tenant columns
```

### Pattern 1: Stripe Billing Portal via Server Action

**What:** Create a Server Action that generates a Stripe Billing Portal session URL and redirects the user.
**When to use:** When the user clicks "Manage Subscription" or "Upgrade Plan".
**Why Server Action, not API route:** Consistent with existing codebase pattern (auth actions use Server Actions). The billing portal action needs the user's session to look up their `stripe_customer_id`.

```typescript
// src/app/actions/billing.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function createBillingPortalSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) return { error: 'No tenant found' }

  // Fetch stripe_customer_id from tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', tenantId)
    .single()

  if (!tenant?.stripe_customer_id) {
    return { error: 'No billing account found' }
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  })

  redirect(session.url)
}
```

**Source:** [Stripe Billing Portal API - Create Session](https://docs.stripe.com/api/customer_portal/sessions/create?lang=node)

### Pattern 2: Team Invite Flow (Custom, Not inviteUserByEmail)

**What:** Custom invite system using an `invites` table, Resend for email delivery, and an accept route that handles both new and existing users.
**When to use:** When an admin/owner invites a team member by email.
**Why custom:** Supabase's `inviteUserByEmail` is designed for inviting users to your *app*, not for multi-tenant team invites. Per the Supabase community discussion, custom invite systems are recommended for multi-tenant apps because you need to control tenant association and role assignment.

**Flow:**
1. Admin submits invite form (email + role)
2. Server Action creates invite record in `invites` table with unique token
3. Server Action sends email via Resend with accept link containing token
4. Recipient clicks link -> `/invite/accept?token=xxx`
5. Accept route checks:
   - If user exists and is logged in: add to tenant_memberships, update app_metadata
   - If user exists but not logged in: redirect to login, then back to accept
   - If user is new: redirect to minimal signup (password only), then add to tenant

```typescript
// Invite acceptance pattern
// src/app/(auth)/invite/accept/route.ts
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')

  // 1. Validate invite token
  const { data: invite } = await supabase
    .from('invites')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!invite) {
    return redirect('/login?error=Invalid+or+expired+invite')
  }

  // 2. Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // User is logged in - add to tenant directly
    await addUserToTenant(user.id, invite.tenant_id, invite.role)
    await markInviteAccepted(invite.id)
    return redirect('/dashboard')
  }

  // 3. Not logged in - redirect to login/signup with invite context
  return redirect(`/login?invite_token=${token}`)
}
```

**Source:** [Supabase Discussion #6055 - Invite team member implementation](https://github.com/orgs/supabase/discussions/6055)

### Pattern 3: Tier Limit Enforcement (Dual Layer)

**What:** Check resource limits in Server Actions (fast feedback) AND in PostgreSQL trigger functions (last line of defense).
**When to use:** Before any truck or user creation.
**Why dual layer:** Per PITFALLS.md Pitfall 7, UI-only limits are bypassable. Server Actions provide good UX (instant error message), but the DB trigger prevents bypass via direct API calls.

```typescript
// src/lib/tier.ts - EXTEND with limit checking
import { TIER_LIMITS, type SubscriptionPlan } from '@/types'

export async function checkTierLimit(
  supabase: any,
  tenantId: string,
  resource: 'trucks' | 'users'
): Promise<{ allowed: boolean; current: number; limit: number }> {
  // Fetch tenant plan
  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single()

  const plan = tenant?.plan as SubscriptionPlan
  if (!plan || !(plan in TIER_LIMITS)) {
    return { allowed: false, current: 0, limit: 0 }
  }

  const limit = TIER_LIMITS[plan][resource]

  // Count current resources
  const table = resource === 'trucks' ? 'trucks' : 'tenant_memberships'
  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  return {
    allowed: (count ?? 0) < limit,
    current: count ?? 0,
    limit: limit === Infinity ? -1 : limit,  // -1 signals unlimited
  }
}
```

```sql
-- Database trigger for truck limit enforcement
CREATE OR REPLACE FUNCTION public.enforce_truck_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  tenant_plan TEXT;
  max_trucks INTEGER;
BEGIN
  SELECT plan INTO tenant_plan FROM public.tenants WHERE id = NEW.tenant_id;

  max_trucks := CASE tenant_plan
    WHEN 'starter' THEN 5
    WHEN 'pro' THEN 20
    WHEN 'enterprise' THEN 2147483647  -- effectively unlimited
    ELSE 0  -- trial: use starter limits
  END;

  SELECT COUNT(*) INTO current_count FROM public.trucks WHERE tenant_id = NEW.tenant_id;

  IF current_count >= max_trucks THEN
    RAISE EXCEPTION 'Truck limit reached for your plan (% of %). Please upgrade.', current_count, max_trucks;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_truck_limit
  BEFORE INSERT ON public.trucks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_truck_limit();
```

**Source:** [PITFALLS.md Pitfall 7](file:///.planning/research/PITFALLS.md), [Supabase Discussion #18715](https://github.com/orgs/supabase/discussions/18715)

### Pattern 4: Dunning Flow (Grace Period + Soft Lockout)

**What:** When payment fails, grant a grace period before restricting access. Use tenant columns to track grace state.
**When to use:** On `invoice.payment_failed` webhook.
**Why:** Per success criteria, "failed payment triggers grace period, not immediate lockout." This is standard B2B SaaS practice -- B2B products typically allow 14-21 day grace periods.

**DB columns needed on tenants:**
- `grace_period_ends_at TIMESTAMPTZ` - when grace period expires (null = not in grace)
- `is_suspended BOOLEAN DEFAULT false` - hard lockout after grace expires

**Flow:**
1. `invoice.payment_failed` fires -> set `subscription_status = 'past_due'`, set `grace_period_ends_at = NOW() + 14 days`
2. Send email to tenant owner: "Your payment failed. Update payment method within 14 days."
3. During grace period: show banner in UI, allow full access
4. After grace period: `is_suspended = true`, show "Account Suspended" overlay, block data-mutation actions
5. `invoice.paid` fires -> clear grace period, clear suspension

**Implementation: Cron or check-on-access?**
For MVP, use check-on-access: the dashboard layout already fetches tenant data. Add `grace_period_ends_at` and `is_suspended` to the layout query. If `is_suspended`, show suspension overlay. If `grace_period_ends_at` is past but `is_suspended` is false, a server action can set it. For production scale, a Vercel cron job at `/api/cron/check-grace-periods` would be more reliable.

### Pattern 5: Onboarding Wizard (Client-Side Stepper)

**What:** Multi-step guided setup that walks new users through adding their first driver, truck, and order.
**When to use:** After signup, when tenant has zero resources.
**Why custom stepper:** No new library needed. Use existing shadcn/ui components (Card, Button, Progress) with simple step state management.

```typescript
// Wizard container pattern
'use client'
import { useState } from 'react'

const STEPS = [
  { id: 'driver', label: 'Add Your First Driver' },
  { id: 'truck', label: 'Add Your First Truck' },
  { id: 'order', label: 'Create Your First Order' },
] as const

export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const handleStepComplete = () => {
    setCompletedSteps(prev => new Set(prev).add(currentStep))
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  // Render current step component with onComplete callback
  // Each step reuses existing form components (DriverForm, TruckForm, OrderForm)
}
```

**Key insight:** Reuse existing CRUD form components from Phases 2-3. The wizard wraps them with step navigation and completion tracking, not new forms.

### Anti-Patterns to Avoid

- **Rebuilding webhook infrastructure:** The webhook route, idempotency, and handlers already exist. EXTEND the switch statement and add new handler functions. Do NOT create a new webhook endpoint.
- **Using inviteUserByEmail for multi-tenant invites:** It invites to the *app*, not to a specific tenant. Use custom invite table + Resend.
- **Enforcing limits only in the UI:** Savvy users can call Supabase directly. DB triggers are the last line of defense.
- **Using Edge Functions for webhooks:** Per research flags, use Vercel API routes (Node.js runtime). Edge Functions have restrictions on body parsing needed for signature verification.
- **Immediate lockout on payment failure:** Always grace period first. B2B SaaS standard is 14-21 days.
- **Hardcoding plan limits in multiple places:** Use the existing `TIER_LIMITS` constant from `@/types/index.ts`. It's already defined with Starter/Pro/Enterprise limits.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subscription management UI | Custom upgrade/downgrade pages | Stripe Billing Portal | Handles proration, payment method updates, invoice history, cancel/reactivate out of the box |
| Webhook signature verification | Custom HMAC validation | `stripe.webhooks.constructEvent()` | Already in use; handles all edge cases including clock skew |
| Email delivery | Custom SMTP integration | Resend (already configured) | Already sending invoice emails; reuse for invite emails |
| Webhook idempotency | Custom dedup logic | Existing `stripe_events` table pattern | Already implemented in Phase 1; just continue using it |
| Email templates | Raw HTML strings | React Email (already configured) | Already creating invoice emails with `@react-email/components` |
| Form validation | Manual validation | Zod + react-hook-form (already configured) | Consistent with all existing forms |
| Multi-step form state | Complex state library | React useState + step index | Simple enough; wizard has 3 steps, not 10. Zustand overkill. |

**Key insight:** Phase 5 is a "polish" phase. Nearly every building block already exists. The work is wiring them together, not building from scratch.

## Common Pitfalls

### Pitfall 1: Stripe Portal Not Configured in Dashboard

**What goes wrong:** `stripe.billingPortal.sessions.create()` returns a URL, but it shows an error page because the portal isn't configured in the Stripe Dashboard.
**Why it happens:** The Billing Portal requires manual Dashboard configuration before API use. Products and prices must be added to the portal's product catalog.
**How to avoid:** Before coding the integration: (1) Go to Stripe Dashboard > Settings > Billing > Customer portal, (2) Enable subscription management, (3) Add all three products (Starter/Pro/Enterprise) to the catalog, (4) Configure cancellation behavior (cancel at period end, not immediately).
**Warning signs:** Portal URL loads but shows "No subscriptions to manage" or a blank page.

### Pitfall 2: JWT Stale After Plan Change via Billing Portal

**What goes wrong:** User upgrades via Billing Portal. Webhook updates the tenant's plan in the DB. But the user's JWT still has the old plan for up to 1 hour.
**Why it happens:** JWTs are stateless snapshots (PITFALLS.md Pitfall 5). The custom_access_token_hook only runs on token refresh.
**How to avoid:** After returning from the Billing Portal (user lands on `/settings`), force a session refresh: `await supabase.auth.refreshSession()`. For critical tier checks (like limit enforcement), always check the DB directly in Server Actions, not JWT claims.
**Warning signs:** User upgrades from Starter to Pro but still gets "truck limit reached" errors.

### Pitfall 3: Invite Token Predictability

**What goes wrong:** Invite tokens are sequential or guessable. An attacker enumerates tokens and joins tenants they weren't invited to.
**Why it happens:** Using auto-increment IDs or short random strings as tokens.
**How to avoid:** Use `crypto.randomUUID()` for invite tokens (UUID v4). Set token expiry (72 hours is standard). Mark token as used after acceptance (prevent replay).
**Warning signs:** No expiry on tokens, or tokens are short numeric strings.

### Pitfall 4: Race Condition in Tier Limit Checks

**What goes wrong:** Two users simultaneously create trucks. Both pass the limit check (count is 4, limit is 5). Both inserts succeed, resulting in 6 trucks.
**Why it happens:** Server Action checks are non-atomic. The count query and insert are separate operations.
**How to avoid:** The DB trigger (BEFORE INSERT) runs inside the transaction, making it atomic. The Server Action check is for UX only (fast feedback); the DB trigger is the real enforcement. Use `SECURITY DEFINER` on the trigger function so it can read the tenant table regardless of RLS.
**Warning signs:** Count-then-insert pattern without transactional protection.

### Pitfall 5: Webhook Handler Timeout for Email Sending

**What goes wrong:** Dunning email sent inside the webhook handler takes too long. Stripe times out (20 second limit) and retries, triggering duplicate emails.
**Why it happens:** Email delivery can be slow. Webhook handlers should be fast.
**How to avoid:** Mark the event as processed BEFORE sending the email (or use a separate async process). The current pattern marks events AFTER processing. For email-sending handlers, consider: (1) Process webhook (update DB) synchronously, (2) Send email asynchronously or via a separate queue. For MVP, accepting occasional duplicate emails on retry is acceptable since the DB update is idempotent.
**Warning signs:** Multiple "Payment failed" emails to the same customer for the same event.

### Pitfall 6: Missing `app_metadata` Update When Invite Is Accepted

**What goes wrong:** Invited user joins the tenant (added to `tenant_memberships`), but their JWT doesn't include the new `tenant_id` and `role` because `app_metadata` was never updated.
**Why it happens:** The signup flow in `auth.ts` manually sets `app_metadata` via `admin.auth.admin.updateUserById()`. The invite acceptance flow must do the same.
**How to avoid:** On invite acceptance, always: (1) Insert into `tenant_memberships`, (2) Update user's `app_metadata` with `tenant_id` and `role`, (3) Force session refresh. The existing JWT hook (`custom_access_token_hook`) will pick it up on next token refresh, but explicit update ensures immediate effect.
**Warning signs:** Invited user sees "No tenant found" after accepting invite.

## Code Examples

### Example 1: Extended Webhook Handler for Dunning

```typescript
// Source: Existing webhook-handlers.ts pattern + Stripe dunning docs
// Add to src/lib/stripe/webhook-handlers.ts

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const supabase = createServiceRoleClient()

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : (invoice.subscription as any)?.id

  if (!subscriptionId) return

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (!tenant) return

  // Clear grace period and suspension on successful payment
  await supabase
    .from('tenants')
    .update({
      subscription_status: 'active',
      grace_period_ends_at: null,
      is_suspended: false,
    })
    .eq('id', tenant.id)
}

export async function handlePaymentFailedWithGrace(invoice: Stripe.Invoice) {
  const supabase = createServiceRoleClient()

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : (invoice.subscription as any)?.id

  if (!subscriptionId) return

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, grace_period_ends_at')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (!tenant) return

  // Only set grace period if not already in one
  const updates: Record<string, any> = {
    subscription_status: 'past_due',
  }

  if (!tenant.grace_period_ends_at) {
    updates.grace_period_ends_at = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000 // 14 days
    ).toISOString()
  }

  await supabase
    .from('tenants')
    .update(updates)
    .eq('id', tenant.id)

  // TODO: Send dunning email via Resend to tenant owner
}
```

### Example 2: Invite Server Action

```typescript
// Source: Existing auth.ts pattern + Supabase admin API
// src/app/actions/invites.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { resend } from '@/lib/resend/client'
import { z } from 'zod'
import crypto from 'crypto'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'dispatcher', 'viewer']),
})

export async function sendInvite(data: unknown) {
  const parsed = inviteSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid input' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) return { error: 'No tenant found' }

  // Check user limit before inviting
  // (import checkTierLimit from lib/tier.ts)

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours

  const admin = createServiceRoleClient()

  // Insert invite record
  const { error: insertError } = await admin
    .from('invites')
    .insert({
      tenant_id: tenantId,
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
      status: 'pending',
    })

  if (insertError) return { error: 'Failed to create invite' }

  // Fetch tenant name for email
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  // Send invite email via Resend
  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept?token=${token}`

  await resend.emails.send({
    from: `${tenant?.name || 'VroomX'} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
    to: [parsed.data.email],
    subject: `You've been invited to join ${tenant?.name || 'a team'} on VroomX`,
    // Use React Email template (InviteEmail component)
    html: `<p>You've been invited to join ${tenant?.name} as ${parsed.data.role}.</p>
           <p><a href="${acceptUrl}">Accept Invite</a></p>
           <p>This invite expires in 72 hours.</p>`,
  })

  return { success: true }
}
```

### Example 3: Settings Page with Billing Portal Link

```typescript
// Source: Existing dashboard page pattern
// src/app/(dashboard)/settings/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BillingSection } from './billing-section'
import { TeamSection } from './team-section'
import { UsageSection } from './usage-section'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  const userRole = user.app_metadata?.role

  // Fetch tenant with subscription info
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single()

  // Fetch team members
  // NOTE: This requires a join or separate query since
  // tenant_memberships doesn't store user email/name

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <BillingSection tenant={tenant} />
      <UsageSection tenantId={tenantId} plan={tenant?.plan} />
      {(userRole === 'owner' || userRole === 'admin') && (
        <TeamSection tenantId={tenantId} />
      )}
    </div>
  )
}
```

### Example 4: Webhook Route Extension

```typescript
// Source: Existing route.ts pattern
// EXTEND the switch statement in src/app/api/webhooks/stripe/route.ts

// Add new cases:
case 'invoice.paid':
  await handleInvoicePaid(event.data.object as Stripe.Invoice)
  break
case 'customer.subscription.trial_will_end':
  await handleTrialWillEnd(event.data.object as Stripe.Subscription)
  break
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom subscription management UI | Stripe Billing Portal | Stripe Portal v2 (2023+) | No need to build upgrade/downgrade/cancel pages; Stripe handles proration, payment method updates, invoice history |
| `inviteUserByEmail` for teams | Custom invite table + Resend | Supabase community consensus (2024+) | Multi-tenant invite requires custom logic; `inviteUserByEmail` is for single-tenant apps |
| Manual dunning emails | Stripe Smart Retries + custom email | Stripe Revenue Recovery (2024+) | Stripe handles retry scheduling automatically; app handles customer communication and access control |
| Middleware.ts for auth guards | Proxy.ts in Next.js 16 | Next.js 16 (2025) | Already using proxy.ts pattern; onboarding redirect already exists |

**Deprecated/outdated:**
- Stripe Checkout for plan changes: Use Billing Portal instead. Checkout is for initial subscription creation.
- Supabase `inviteUserByEmail` for multi-tenant: Not designed for tenant-scoped invites. Use custom implementation.

## Existing Infrastructure Inventory

Critical for planning -- what already exists and must be EXTENDED not rebuilt:

| Component | File | What Exists | What Phase 5 Adds |
|-----------|------|-------------|-------------------|
| Webhook route | `src/app/api/webhooks/stripe/route.ts` | Signature verification, idempotency, 4 event types | 2-3 new event types in switch |
| Webhook handlers | `src/lib/stripe/webhook-handlers.ts` | checkout.completed, sub.updated, sub.deleted, payment.failed | invoice.paid, trial_will_end, payment_failed_with_grace |
| Stripe config | `src/lib/stripe/config.ts` | Client, PRICE_MAP, PLAN_FROM_PRICE | No changes needed |
| Tenant schema | `src/db/schema.ts` tenants table | plan, subscription_status, stripe_* | grace_period_ends_at, is_suspended |
| Tenant memberships | `src/db/schema.ts` tenant_memberships | tenant_id, user_id, role | No changes needed (invites are separate table) |
| stripe_events | `src/db/schema.ts` stripe_events | event_id, event_type, processed_at | No changes needed |
| Tier types | `src/types/index.ts` | TIER_LIMITS, TIER_PRICING, TenantRole | No changes needed |
| Tier utils | `src/lib/tier.ts` | getTierDisplayName, getStatusBadgeColor, hasMinRole | checkTierLimit, isAccountSuspended |
| Resend client | `src/lib/resend/client.ts` | Initialized Resend instance | No changes needed |
| Email template | `src/components/email/invoice-email.tsx` | Invoice email template | New invite-email.tsx |
| Auth actions | `src/app/actions/auth.ts` | signUp (creates tenant, membership, Stripe customer) | Reference for invite accept flow |
| Dashboard layout | `src/app/(dashboard)/layout.tsx` | Auth check, tenant fetch | Add grace period / suspension check |
| Proxy | `src/lib/supabase/proxy.ts` | Auth redirects, onboarding redirect | No changes needed (onboarding redirect already exists!) |
| Sidebar | `src/components/layout/sidebar.tsx` | Settings link exists | No changes needed |
| Dashboard page | `src/app/(dashboard)/dashboard/page.tsx` | Quick start guide placeholder | Replace with smart onboarding CTA |
| Signup page | `src/app/(auth)/signup/page.tsx` | Plan selection, tier limits display | Reference for upgrade CTA |

**Key discovery:** The proxy already handles the onboarding redirect case: if user has no `tenant_id` and hits `/dashboard`, redirects to `/onboarding`. This means the onboarding wizard route just needs to exist at `/onboarding`.

## Open Questions

1. **Trial-to-paid transition for existing trial users**
   - What we know: Trial is set at checkout level (14 days). `customer.subscription.trial_will_end` fires 3 days before.
   - What's unclear: Should we send a custom "trial ending" email via Resend, or rely on Stripe's automatic emails?
   - Recommendation: Handle `trial_will_end` webhook and send a branded email via Resend with a CTA to add payment method. More control over branding and messaging.

2. **Team member limit: does it count tenant_memberships or invites?**
   - What we know: TIER_LIMITS defines `users: 3/10/Infinity`. The `tenant_memberships` table stores accepted members.
   - What's unclear: Should pending invites count toward the limit?
   - Recommendation: Count only accepted members (rows in `tenant_memberships`). Pending invites should NOT count since they may expire or be declined. But DO check at invite time that accepting would not exceed the limit, and include a warning in the invite action if close to limit.

3. **Onboarding wizard: separate route or dashboard overlay?**
   - What we know: Proxy already redirects users without `tenant_id` to `/onboarding`. But newly signed up users DO have a `tenant_id` (created during signup).
   - What's unclear: The onboarding wizard is for users who have zero resources (no trucks/drivers/orders), not users without a tenant.
   - Recommendation: Show the onboarding wizard as a prominent section on the dashboard page when entity counts are zero. Use the existing Quick Start Guide section as the mounting point. Do NOT redirect -- just make it the primary CTA on the dashboard. Mark onboarding as "complete" via a tenant column (`onboarding_completed_at`) or simply detect when entities exist.

4. **Account suspension: how restrictive?**
   - What we know: Grace period should allow full access. After grace, account should be restricted.
   - What's unclear: Should suspended accounts see data read-only, or be fully locked out?
   - Recommendation: Read-only during suspension. Users should be able to view their data (orders, invoices) but not create new resources. Show a persistent banner with "Update Payment Method" link to Billing Portal.

## Sources

### Primary (HIGH confidence)
- Stripe Billing Portal API: [Create Session](https://docs.stripe.com/api/customer_portal/sessions/create?lang=node) - Verified parameters and response format
- Stripe Subscription Webhooks: [Webhook Events](https://docs.stripe.com/billing/subscriptions/webhooks) - Complete event lifecycle verified
- Stripe Customer Portal Integration: [Integration Guide](https://docs.stripe.com/customer-management/integrate-customer-portal) - Configuration requirements, 13 portal webhook events confirmed
- Stripe Subscription Trials: [Trial Documentation](https://docs.stripe.com/billing/subscriptions/trials) - Trial-to-paid transition, `trial_will_end` event behavior
- Existing codebase: All files read and verified directly

### Secondary (MEDIUM confidence)
- Supabase Discussion #6055: [Invite team member implementation](https://github.com/orgs/supabase/discussions/6055) - Community consensus on custom invite systems for multi-tenant
- Supabase `inviteUserByEmail`: [API Reference](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) - Confirmed PKCE not supported, limited multi-tenant support
- Stripe Revenue Recovery: [Revenue Recovery Docs](https://docs.stripe.com/billing/revenue-recovery) - Smart Retries, automated emails
- Stripe Dunning Best Practices: [Churnkey Article](https://churnkey.co/blog/stripe-dunning/) - B2B grace period recommendations (14-21 days)
- [Pedro Alonso - Stripe Subscriptions in Next.js](https://www.pedroalonso.net/blog/stripe-subscriptions-nextjs/) - Billing Portal implementation pattern

### Tertiary (LOW confidence)
- Supabase Discussion #18715: [RLS row count limiting](https://github.com/orgs/supabase/discussions/18715) - SECURITY DEFINER trigger approach for limit enforcement
- [Medium - Multi-Step Wizard in React](https://medium.com/@brunno.tripovichy/building-a-scalable-multi-step-wizard-in-react-with-tailwind-css-31147cded202) - General wizard patterns (no new libraries needed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use. Zero new dependencies.
- Architecture: HIGH - All patterns extend existing codebase patterns verified by direct file reading.
- Pitfalls: HIGH - PITFALLS.md already documents key risks (CRIT-4 webhook idempotency, Pitfall 5 JWT staleness, Pitfall 7 tier enforcement). Stripe docs verified dunning behavior.
- Invite flow: MEDIUM - Custom approach recommended by community consensus, but specific implementation details are original design (not copied from verified source).
- Onboarding wizard: MEDIUM - Simple UI pattern, but the "when to show" logic needs product decision (open question #3).

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days - stable domain, established libraries)
