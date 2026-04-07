'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { rateLimit } from '@/lib/rate-limit'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Stripe from 'stripe'
import { z } from 'zod'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover',
  })
}

// AUTH-004: strengthen the password policy. 8 characters with no
// complexity requirement accepted trivially weak passwords like
// "password", "12345678", "aaaaaaaa". Raised to 12+ characters with
// at least one uppercase, one digit, and one symbol — still well short
// of NIST 800-63B's recommendation but closes the easy-guess window
// without pulling in a dictionary-based estimator (zxcvbn).
const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter')
  .regex(/[0-9]/, 'Password must include at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one symbol')

const signUpSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  company_name: z.string().min(1, 'Company name is required'),
  plan: z.enum(['starter', 'pro', 'enterprise']),
  dot_number: z.string().optional(),
  mc_number: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
})

const PRICE_MAP: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID!,
  pro: process.env.STRIPE_PRO_PRICE_ID!,
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
}

export async function loginAction(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const inviteToken = formData.get('invite_token') as string | null

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error('[LOGIN] Auth error:', error.message)
    return { error: 'Invalid email or password' }
  }

  // Auth success logged without PII

  revalidatePath('/', 'layout')

  // If invite_token present, redirect to accept route instead of dashboard
  if (inviteToken) {
    redirect(`/invite/accept?token=${inviteToken}`)
  }

  redirect('/dashboard')
}

export async function signUpAction(prevState: any, formData: FormData) {
  // 0. Rate limit signup by IP — signup is unauthenticated, so authorize()
  // doesn't apply. C3 fix: prevent enumeration via repeated signup attempts.
  //
  // AUTH-002: prefer `x-nf-client-connection-ip` as the primary IP source.
  // Netlify's edge sets this header from the real TCP client IP and clients
  // cannot override it. `x-forwarded-for` is kept as a fallback for local
  // dev and non-Netlify deployments but should never be the only source of
  // truth — attackers can spoof it and rotate spoofed IPs to bypass the
  // 5/min cap. Mirror the fix already in src/lib/supabase/proxy.ts (CFG-008).
  const hdrs = await headers()
  const ip =
    hdrs.get('x-nf-client-connection-ip')?.trim() ||
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    hdrs.get('x-real-ip')?.trim() ||
    'unknown'
  const rl = await rateLimit(`signup-ip:${ip}`, { limit: 5, windowMs: 60_000 })
  if (!rl.allowed) {
    return { error: 'Too many signup attempts. Please try again in a minute.' }
  }

  // 1. Validate inputs
  const parsed = signUpSchema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    company_name: formData.get('company_name'),
    plan: formData.get('plan'),
    dot_number: formData.get('dot_number') || undefined,
    mc_number: formData.get('mc_number') || undefined,
    address: formData.get('address') || undefined,
    city: formData.get('city') || undefined,
    state: formData.get('state') || undefined,
    zip: formData.get('zip') || undefined,
    phone: formData.get('phone') || undefined,
  })

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid input'
    return { error: firstError }
  }

  const { full_name, email, password, company_name, plan, dot_number, mc_number, address, city, state, zip, phone } = parsed.data
  const supabase = await createClient()

  // 2. Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
    },
  })

  if (authError || !authData.user) {
    return { error: authError?.message || 'Signup failed' }
  }

  const inviteToken = formData.get('invite_token') as string | null

  // Invited user: create auth user with confirmed email, skip tenant/Stripe setup.
  // The accept route will assign them to the inviting tenant.
  if (inviteToken) {
    const admin = createServiceRoleClient()

    // AUTH-001: validate the invite token against the invites table BEFORE
    // touching anyone's auth record. Prior code called
    // admin.auth.admin.updateUserById(targetUserId, { password, email_confirm: true })
    // whenever an invite_token was present and the email happened to match
    // a pre-existing auth.users row. The token was never checked — so an
    // attacker with any non-empty token value could reset the password of
    // any pre-invited email. Validating here fails closed: unknown/expired/
    // email-mismatched tokens abort before any service-role write.
    const { data: invite, error: inviteErr } = await admin
      .from('invites')
      .select('id, email, status, expires_at')
      .eq('token', inviteToken)
      .maybeSingle()

    if (inviteErr || !invite) {
      return { error: 'Invalid invite link' }
    }
    if (invite.status !== 'pending') {
      return { error: 'This invite has already been used or was revoked' }
    }
    if (new Date(invite.expires_at) < new Date()) {
      return { error: 'This invite has expired' }
    }
    if (
      typeof invite.email !== 'string' ||
      invite.email.toLowerCase() !== email.toLowerCase()
    ) {
      // Token-email mismatch: someone is trying to claim a token that
      // doesn't belong to them. Log for alerting but return a generic
      // error so we don't confirm which email the token belongs to.
      console.warn('[SIGNUP] Invite token email mismatch', { inviteId: invite.id })
      return { error: 'Invalid invite link' }
    }

    // C3 fix: Check if user was pre-created by admin.inviteUserByEmail() via
    // a targeted RPC lookup instead of admin.auth.admin.listUsers() which
    // loads ALL users into memory and leaks the full user directory.
    const { data: existingUserId } = await admin.rpc(
      'get_auth_user_id_by_email',
      { p_email: email }
    )

    // The freshly signUp()-created user from above may collide with the
    // pre-invited user. Use the existing ID if found, otherwise the new ID.
    const targetUserId = (existingUserId as string | null) ?? authData.user.id
    const isPreInvited = !!existingUserId && existingUserId !== authData.user.id

    if (isPreInvited) {
      // User was pre-created by invite — update their password and confirm.
      // Safe to touch now because we verified the invite token + email match
      // above; the caller has proven they own the invite.
      await admin.auth.admin.updateUserById(targetUserId, {
        password,
        email_confirm: true,
        user_metadata: { full_name },
        app_metadata: { pending_invite: true },
      })
    } else {
      // User wasn't pre-created — confirm email directly so sign-in works
      await admin.auth.admin.updateUserById(targetUserId, {
        email_confirm: true,
        app_metadata: { pending_invite: true },
      })
    }

    // Sign them in so the accept route sees an authenticated user
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      console.error('[SIGNUP] Sign-in after invite signup failed:', signInError.message)
      return { error: 'Account created but sign-in failed. Please try logging in.' }
    }
    revalidatePath('/', 'layout')
    redirect(`/invite/accept?token=${inviteToken}`)
  }

  // 3. Create Stripe customer
  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email,
    name: company_name,
    metadata: { supabase_user_id: authData.user.id },
  })

  // 4. Create tenant via service role (bypasses RLS)
  const admin = createServiceRoleClient()

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({
      name: company_name,
      slug: company_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      plan: 'trial',
      subscription_status: 'trialing',
      stripe_customer_id: customer.id,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      ...(dot_number && { dot_number }),
      ...(mc_number && { mc_number }),
      ...(address && { address }),
      ...(city && { city }),
      ...(state && { state }),
      ...(zip && { zip }),
      ...(phone && { phone }),
    })
    .select()
    .single()

  if (tenantError || !tenant) {
    console.error('[SIGNUP] Tenant creation failed:', tenantError?.message)
    return { error: 'Failed to create organization' }
  }

  // 5. Create tenant membership (admin role) with name/email for display
  await admin.from('tenant_memberships').insert({
    tenant_id: tenant.id,
    user_id: authData.user.id,
    role: 'admin',
    full_name,
    email,
  })

  // 6. Set app_metadata on user
  await admin.auth.admin.updateUserById(authData.user.id, {
    app_metadata: {
      tenant_id: tenant.id,
      role: 'admin',
      plan: 'trial',
    },
  })

  // 7. Create Stripe Checkout Session with 14-day trial
  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: 'subscription',
    line_items: [{ price: PRICE_MAP[plan], quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { tenant_id: tenant.id },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?setup=complete`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/signup?error=${encodeURIComponent('Checkout canceled')}`,
    metadata: { tenant_id: tenant.id },
  })

  // 8. Redirect to Stripe Checkout
  if (session.url) {
    redirect(session.url)
  }

  return { error: 'Failed to create checkout session' }
}

export async function magicLinkAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  if (!email || !email.includes('@')) {
    return { error: 'Please enter a valid email address' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth-confirm`,
    },
  })

  if (error) {
    if (error.message.includes('Signups not allowed')) {
      return { error: 'No account found with this email. Please sign up first.' }
    }
    return { error: error.message }
  }

  return { success: true, message: 'Check your email for the login link. It expires in 1 hour.' }
}
