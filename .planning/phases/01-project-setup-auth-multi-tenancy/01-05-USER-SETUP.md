# User Setup Required: Stripe Integration (Plan 01-05)

This plan implemented Stripe webhook integration. Before the webhook endpoint can process events, you need to configure your Stripe account and add environment variables.

## 1. Create Stripe Account (if needed)

1. Go to https://stripe.com
2. Sign up or log in
3. Switch to **Test mode** (toggle in top-right)

## 2. Get API Keys

1. In Stripe Dashboard, go to **Developers → API keys**
2. Copy your **Secret key** (starts with `sk_test_`)
3. Add to `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_test_51...
   ```

## 3. Create Products and Prices

You need to create 3 products with recurring prices:

### Starter Plan ($49/month)

1. Go to **Products → Add product**
2. Name: "Starter Plan"
3. Pricing model: Recurring
4. Price: $49/month
5. Click **Save product**
6. Copy the **Price ID** (starts with `price_`)
7. Add to `.env.local`:
   ```
   STRIPE_STARTER_PRICE_ID=price_...
   ```

### Pro Plan ($149/month)

1. Repeat above with:
   - Name: "Pro Plan"
   - Price: $149/month
2. Copy Price ID to `.env.local`:
   ```
   STRIPE_PRO_PRICE_ID=price_...
   ```

### Enterprise Plan ($499/month)

1. Repeat above with:
   - Name: "Enterprise Plan"
   - Price: $499/month
2. Copy Price ID to `.env.local`:
   ```
   STRIPE_ENTERPRISE_PRICE_ID=price_...
   ```

## 4. Configure Webhook Endpoint

### Local Development (using Stripe CLI)

1. Install Stripe CLI:
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. Copy the **webhook signing secret** from the output (starts with `whsec_`)
5. Add to `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Production (after deployment)

1. In Stripe Dashboard, go to **Developers → Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** and update your production environment variable:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## 5. Final Environment Variables

Your `.env.local` should have these 5 Stripe variables:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
```

## 6. Verify Setup

### Test webhook locally:

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. In another terminal, run:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

3. Trigger a test event:
   ```bash
   stripe trigger checkout.session.completed
   ```

4. Check your terminal for webhook processing logs
5. Check your database - a record should appear in `stripe_events` table

### Expected output:

```
✓ Webhook signature verified
✓ Event processed: evt_...
✓ stripe_events table updated
```

## Troubleshooting

**"Missing stripe-signature header"**
- Make sure Stripe CLI is forwarding to the correct port
- Verify your dev server is running on port 3000

**"Invalid signature"**
- Check that STRIPE_WEBHOOK_SECRET matches the one from `stripe listen` output
- Restart your dev server after adding the env var

**"Webhook handler failed"**
- Check that your database is accessible
- Verify SUPABASE_SECRET_KEY is set (service role client needs it)
- Check tenant exists with matching metadata.tenant_id

## Next Steps

Once Stripe is configured:
- Plan 01-06 will build the dashboard subscription UI
- Plan 01-07 will implement the billing page with checkout session creation
- The webhook endpoint will automatically sync subscription changes to your database

---
*Setup guide for Plan 01-05*
*Last updated: 2026-02-11*
