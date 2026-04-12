import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe/config'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handlePaymentFailed,
  handleInvoicePaid,
  handlePaymentFailedWithGrace,
} from '@/lib/stripe/webhook-handlers'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const sig = headersList.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // 1. Verify webhook signature
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // 2. Idempotency — INSERT-first pattern (N6 fix).
  // The previous SELECT-then-INSERT had a TOCTOU race: under concurrent
  // Stripe retries, two instances could both pass the SELECT check and
  // process the same event twice. INSERT-first with a unique constraint on
  // event_id ensures only one instance wins; the loser catches the 23505
  // unique_violation and returns 200 (already processed). This matches the
  // pattern already used in the QuickBooks webhook handler.
  const supabase = createServiceRoleClient()
  const { error: dupError } = await supabase.from('stripe_events').insert({
    event_id: event.id,
    event_type: event.type,
    processed_at: new Date().toISOString(),
  })

  if (dupError) {
    // 23505 = unique_violation → event already claimed by another instance
    if (dupError.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    // Non-duplicate DB error — log and return 500 so Stripe retries
    console.error('[stripe-webhook] idempotency insert failed:', dupError.message)
    return NextResponse.json({ error: 'Idempotency check failed' }, { status: 500 })
  }

  // 3. Process based on event type
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailedWithGrace(event.data.object as Stripe.Invoice)
        break
      default:
        // Unhandled event type — no action needed
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`Webhook handler error for ${event.type}:`, error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
