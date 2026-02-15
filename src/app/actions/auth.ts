'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Stripe from 'stripe'
import { z } from 'zod'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover',
  })
}

const signUpSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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
    return { error: error.message }
  }

  console.log('[LOGIN] Success for:', email, 'user_id:', data.user?.id)
  console.log('[LOGIN] app_metadata:', JSON.stringify(data.user?.app_metadata))

  revalidatePath('/', 'layout')

  // If invite_token present, redirect to accept route instead of dashboard
  if (inviteToken) {
    redirect(`/invite/accept?token=${inviteToken}`)
  }

  redirect('/dashboard')
}

export async function signUpAction(prevState: any, formData: FormData) {
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

  // Invited user: just create auth user, skip tenant/Stripe setup.
  // The accept route will assign them to the inviting tenant.
  if (inviteToken) {
    const admin = createServiceRoleClient()
    await admin.auth.admin.updateUserById(authData.user.id, {
      app_metadata: { pending_invite: true },
    })
    // Sign them in so the accept route sees an authenticated user
    await supabase.auth.signInWithPassword({ email, password })
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
    return { error: tenantError?.message || 'Failed to create organization' }
  }

  // 5. Create tenant membership (owner role)
  await admin.from('tenant_memberships').insert({
    tenant_id: tenant.id,
    user_id: authData.user.id,
    role: 'owner',
  })

  // 6. Set app_metadata on user
  await admin.auth.admin.updateUserById(authData.user.id, {
    app_metadata: {
      tenant_id: tenant.id,
      role: 'owner',
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
