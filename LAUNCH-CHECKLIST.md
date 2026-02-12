# VroomX TMS -- Pre-Launch Checklist

Last updated: 2026-02-12

---

## 1. Environment Setup

### Supabase
- [ ] Upgrade to Supabase Pro plan for production
- [ ] Enable Point-in-Time Recovery (PITR) for database
- [ ] Configure custom SMTP for auth emails (Settings > Auth > SMTP)
- [ ] Set Site URL to production domain (Settings > Auth > URL Configuration)
- [ ] Add production redirect URLs for OAuth/magic link
- [ ] Create storage buckets: `receipts`, `documents`, `attachments`, `inspections`
- [ ] Set storage bucket policies (authenticated uploads, public reads where needed)
- [ ] Enable database backups on schedule

### Vercel
- [ ] Connect GitHub repository to Vercel project
- [ ] Set production branch to `main`
- [ ] Configure custom domain and verify DNS
- [ ] Set all environment variables (see Environment Variables section below)
- [ ] Enable Speed Insights
- [ ] Enable Web Analytics
- [ ] Configure Edge Config for feature flags (optional)

### Stripe
- [ ] Switch from test mode to live mode
- [ ] Create live price IDs for Starter, Pro, Enterprise plans
- [ ] Update `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID` with live IDs
- [ ] Configure live webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
- [ ] Enable webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
- [ ] Update `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with live keys
- [ ] Test a live subscription flow with a real card
- [ ] Configure Stripe billing portal branding

### Resend
- [ ] Verify production sending domain
- [ ] Create production API key
- [ ] Update `RESEND_API_KEY` environment variable
- [ ] Set FROM address to verified domain (e.g., `billing@yourdomain.com`)

### Sentry
- [ ] Create production project (or use existing)
- [ ] Set `NEXT_PUBLIC_SENTRY_DSN` for production
- [ ] Configure `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- [ ] Set up alert rules (error spike, new issue)
- [ ] Enable source map uploads in CI/CD

### PostHog
- [ ] Create production project
- [ ] Set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`
- [ ] Verify reverse proxy at `/ingest` routes to PostHog
- [ ] Configure session recording (optional)
- [ ] Set up key funnels: signup > checkout > dashboard > first order

---

## 2. Environment Variables

All required environment variables for production:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

# Database
DATABASE_URL=postgresql://...  (pooled connection)
DATABASE_URL_DIRECT=postgresql://...  (direct connection for migrations)

# Stripe (LIVE keys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=your-org
SENTRY_PROJECT=vroomx
SENTRY_AUTH_TOKEN=sntrys_...

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Resend
RESEND_API_KEY=re_...
```

Verification:
- [ ] No `NEXT_PUBLIC_` variable contains a secret (run `npm run audit:security`)
- [ ] All server-only secrets are NOT prefixed with `NEXT_PUBLIC_`
- [ ] Production URLs do not contain `localhost`

---

## 3. Database

### Migrations
- [ ] Run all migrations against production database
- [ ] Verify migration order: `00001` through `00007`
- [ ] Confirm no migration errors in logs

### Row Level Security (RLS)
- [ ] Run `npm run audit:security` -- verify "RLS coverage" check passes
- [ ] Verify all 21 tables have RLS enabled
- [ ] Test RLS: user A cannot see user B's data

### Data Integrity
- [ ] Verify `stripe_events` table exists for webhook idempotency
- [ ] Confirm `tenant_memberships` table has proper foreign keys
- [ ] Check `tier_enforcement` triggers are active (Starter: 5 trucks/3 drivers, Pro: 20/10)
- [ ] Verify `grace_period_ends_at` column exists on tenants for dunning

---

## 4. Security

### Automated Checks
- [ ] Run `npm run audit:security` -- all checks pass
- [ ] All server actions call `getUser()` before database operations
- [ ] Stripe webhook verifies signature via `constructEvent()`
- [ ] No hardcoded secret keys in `src/` directory
- [ ] No server-only env vars referenced in client components

### Manual Verification
- [ ] Verify CORS configuration in Supabase (restrict to production domain)
- [ ] Check that `proxy.ts` (Next.js 16) redirects unauthenticated users
- [ ] Confirm invited users cannot bypass tenant isolation
- [ ] Verify owner-only actions (seed data, billing portal) check role
- [ ] Test that suspended accounts are blocked from creating new entities

---

## 5. Performance

### Automated Checks
- [ ] Run `npm run audit:perf` -- review all warnings
- [ ] Font loading uses `display: swap` (verified by audit)
- [ ] No barrel imports from lucide-react (tree-shaking preserved)
- [ ] Viewport metadata exported from root layout

### Core Web Vitals Targets
- [ ] **LCP** (Largest Contentful Paint): < 2.5s
- [ ] **INP** (Interaction to Next Paint): < 200ms
- [ ] **CLS** (Cumulative Layout Shift): < 0.1

### Build Verification
- [ ] Run `npm run build` -- no errors
- [ ] Review build output for route sizes
- [ ] Verify static pages are pre-rendered where possible
- [ ] Check that dynamic routes use proper caching headers

---

## 6. Testing

### Automated Tests
- [ ] Run `npm run test:e2e` -- all E2E tests pass
- [ ] Review test coverage for critical flows

### Manual Smoke Tests
- [ ] **Auth flow:** Sign up with new account > Stripe Checkout > Dashboard
- [ ] **Magic link:** Request magic link > Click email link > Dashboard
- [ ] **Broker CRUD:** Create, edit, view detail, delete broker
- [ ] **Driver CRUD:** Create, toggle status, view detail, delete driver
- [ ] **Truck CRUD:** Create, change status, view detail with trailer section
- [ ] **Order CRUD:** Create via wizard, VIN decode works, status transitions
- [ ] **CSV Import:** Import CSV file with column mapping, orders created
- [ ] **Dispatch:** Create trip, assign orders, view financials, complete trip
- [ ] **Billing:** Send invoice, record payment, view aging analysis
- [ ] **Team:** Invite team member, accept invite, verify role-based access
- [ ] **Settings:** View usage, access billing portal, seed/clear sample data
- [ ] **Marketing:** Landing page loads, pricing page displays 3 tiers
- [ ] **Error handling:** Visit `/nonexistent` -- 404 page renders
- [ ] **Mobile:** Test responsive layout on mobile viewport

---

## 7. Deployment

### Pre-Deploy
- [ ] Merge all feature branches to `main`
- [ ] Ensure `main` branch builds successfully
- [ ] Tag release: `git tag v1.0.0`

### Vercel Deployment
- [ ] Push to `main` (triggers automatic deployment)
- [ ] Verify deployment completes without errors
- [ ] Check deployment logs for any warnings
- [ ] Verify production URL is accessible

### DNS & SSL
- [ ] Point domain A/CNAME records to Vercel
- [ ] Verify SSL certificate is issued and valid
- [ ] Test HTTPS redirect (http:// > https://)
- [ ] Verify `www` subdomain redirects to apex (or vice versa)

### Post-Deploy Verification
- [ ] Visit production URL -- landing page loads
- [ ] Visit `/login` -- login page renders
- [ ] Visit `/pricing` -- pricing page renders
- [ ] Sign up with a test account -- full flow works
- [ ] Verify Stripe webhook receives events (check Stripe Dashboard)

---

## 8. Post-Launch Monitoring

### First 24 Hours
- [ ] Monitor Sentry for new errors (zero unhandled exceptions target)
- [ ] Check PostHog for page view events flowing
- [ ] Verify Stripe webhooks are processing (Dashboard > Webhooks > Events)
- [ ] Monitor Supabase database connections (Dashboard > Database)
- [ ] Check Vercel function execution times (Dashboard > Analytics)

### First Week
- [ ] Review PostHog funnels: signup completion rate
- [ ] Check Sentry error trends: any recurring issues
- [ ] Monitor database query performance in Supabase
- [ ] Review Stripe subscription success rate
- [ ] Check email delivery rates in Resend dashboard
- [ ] Gather initial user feedback

### Ongoing
- [ ] Set up uptime monitoring (e.g., Vercel Speed Insights, BetterStack)
- [ ] Configure PagerDuty/Opsgenie alerts for critical errors
- [ ] Schedule weekly review of Sentry errors
- [ ] Monitor Core Web Vitals in Google Search Console
- [ ] Review and act on PostHog analytics monthly

---

## Quick Reference Commands

```bash
# Build and verify
npm run build

# Run security audit
npm run audit:security

# Run performance audit
npm run audit:perf

# Run E2E tests
npm run test:e2e

# Start development server
npm run dev

# Start production server
npm run build && npm start

# Database migrations (via Supabase CLI)
supabase db push
```
