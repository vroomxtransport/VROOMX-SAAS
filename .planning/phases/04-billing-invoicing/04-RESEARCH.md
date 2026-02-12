# Phase 4: Billing & Invoicing - Research

**Researched:** 2026-02-12
**Domain:** Payment tracking, PDF invoice generation, email delivery, receivables/aging analysis
**Confidence:** HIGH

## Summary

Phase 4 adds the financial backbone to VroomX TMS: payment tracking per order, PDF invoice generation, email delivery via Resend, a receivables dashboard grouped by broker, and aging analysis. The existing codebase already has `invoiced` and `paid` in the order status enum, server actions with Supabase RLS, TanStack Query hooks with realtime subscriptions, and shadcn/ui components -- all patterns that extend naturally into billing.

The core technical challenge is introducing a **payments table** (to support partial payments), a **payment_status enum** separate from order status, **server-side PDF generation** via `@react-pdf/renderer`, and **email sending** via Resend. The tenant table needs additional columns for company info (address, phone) since invoices require a company header. The receivables and aging views are computed queries -- no new tables needed beyond payments.

**Primary recommendation:** Use `@react-pdf/renderer` (v4.3.2) with `renderToBuffer` in Next.js API route handlers for PDF generation, `resend` (v6.x) for email delivery with PDF attachments, and add a `payments` table to track partial payments against orders. Implement the "Billing" page as a new top-level route with broker-grouped receivables and aging analysis computed via Supabase queries with `date_part` bucketing.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-pdf/renderer` | ^4.3.2 | Server-side PDF generation | React component-based PDF creation; `renderToBuffer` works in Next.js 16 with React 19; 1.7M weekly downloads |
| `resend` | ^6.9.2 | Email delivery | Official SDK; works in server actions; supports attachments via `content` (Buffer) parameter; simple API |
| `@react-email/components` | ^1.0.7 | Email templates | Build HTML email templates with React components; pairs with Resend's `react` parameter |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | ^4.1.0 | Date math for aging buckets | `differenceInDays`, `startOfDay` for aging calculation |
| `zod` | ^4.3.6 | Payment form validation | Validate payment amount, date inputs |
| `@tanstack/react-query` | ^5.90.21 | Data fetching + cache | Receivables queries, payment mutations |
| `drizzle-orm` | ^0.45.1 | Schema definition for new tables | Payment table schema, migration generation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@react-pdf/renderer` | `jspdf` v4.0 | jsPDF is lower-level, requires manual coordinate positioning; no React component model; harder to maintain invoice layout |
| `@react-pdf/renderer` | Puppeteer/Playwright | Heavy dependency (Chromium); complex deployment on serverless; overkill for invoice-style documents |
| `resend` | Nodemailer + SMTP | User locked in Resend in CONTEXT.md; Resend is simpler, better DX, managed deliverability |
| `@react-email/components` | Raw HTML strings | React Email provides cross-client compatible HTML, responsive layouts, and Tailwind support |

**Installation:**
```bash
npm install @react-pdf/renderer resend @react-email/components
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── billing/                    # NEW: Top-level billing page
│   │   │   ├── page.tsx               # Receivables dashboard + aging
│   │   │   └── _components/
│   │   │       ├── receivables-table.tsx
│   │   │       ├── aging-table.tsx
│   │   │       ├── batch-actions.tsx
│   │   │       └── collection-rate.tsx
│   │   ├── brokers/[id]/page.tsx      # MODIFY: Add receivables section
│   │   └── orders/
│   │       └── _components/
│   │           ├── order-detail.tsx    # MODIFY: Add payment section + send invoice button
│   │           ├── payment-recorder.tsx # NEW: Inline payment recording form
│   │           └── invoice-button.tsx  # NEW: Generate + send invoice
│   ├── api/
│   │   └── invoices/
│   │       └── [orderId]/
│   │           ├── pdf/route.ts       # NEW: Generate PDF, return buffer
│   │           └── send/route.ts      # NEW: Generate PDF + email via Resend
│   └── actions/
│       └── payments.ts                # NEW: Record payment, batch mark paid
├── components/
│   └── email/
│       └── invoice-email.tsx          # NEW: React Email template for invoice
├── db/
│   └── schema.ts                      # MODIFY: Add payments table, payment_status enum
├── hooks/
│   └── use-payments.ts                # NEW: Payment queries + realtime
├── lib/
│   ├── pdf/
│   │   └── invoice-template.tsx       # NEW: @react-pdf/renderer invoice document
│   ├── queries/
│   │   ├── payments.ts                # NEW: Payment queries
│   │   └── receivables.ts            # NEW: Broker receivables + aging queries
│   ├── validations/
│   │   └── payment.ts                # NEW: Payment recording validation
│   └── resend/
│       └── client.ts                  # NEW: Resend client singleton
├── types/
│   ├── index.ts                       # MODIFY: Add PaymentStatus type, labels, colors
│   └── database.ts                    # MODIFY: Add Payment interface
└── supabase/
    └── migrations/
        └── 00004_billing_invoicing.sql # NEW: payments table, payment_status enum, indexes, RLS
```

### Pattern 1: Server-Side PDF Generation via API Route Handler
**What:** Use a Next.js API route handler at `/api/invoices/[orderId]/pdf` to generate PDFs server-side using `@react-pdf/renderer`'s `renderToBuffer`.
**When to use:** When generating downloadable/emailable PDFs from data.
**Why not server action:** Server actions can't return binary responses; route handlers can stream/return buffers with proper Content-Type headers.
**Example:**
```typescript
// src/app/api/invoices/[orderId]/pdf/route.ts
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoiceDocument } from '@/lib/pdf/invoice-template'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const supabase = await createClient()

  // Fetch order with broker relation
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, broker:brokers(*)')
    .eq('id', orderId)
    .single()

  if (error || !order) {
    return Response.json({ error: 'Order not found' }, { status: 404 })
  }

  // Fetch tenant for company info
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, address, city, state, zip, phone')
    .single()

  const pdfBuffer = await renderToBuffer(
    <InvoiceDocument order={order} tenant={tenant} />
  )

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="INV-${order.order_number}.pdf"`,
    },
  })
}
```

### Pattern 2: Email with PDF Attachment via Resend
**What:** Generate PDF buffer, then send as attachment using Resend's `content` parameter.
**When to use:** "Send Invoice" button triggers server action or API route that generates PDF and emails it.
**Important:** Resend batch API does NOT support attachments. For batch invoice sending, iterate and send individual emails.
**Example:**
```typescript
// src/app/api/invoices/[orderId]/send/route.ts
import { renderToBuffer } from '@react-pdf/renderer'
import { resend } from '@/lib/resend/client'
import { InvoiceEmail } from '@/components/email/invoice-email'
import { InvoiceDocument } from '@/lib/pdf/invoice-template'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  // ... fetch order, tenant, generate PDF buffer ...

  const pdfBuffer = await renderToBuffer(
    <InvoiceDocument order={order} tenant={tenant} />
  )

  const { data, error } = await resend.emails.send({
    from: `${tenant.name} <invoices@yourdomain.com>`,
    to: [order.broker.email],
    subject: `Invoice INV-${order.order_number}`,
    react: InvoiceEmail({ order, tenant }),
    attachments: [
      {
        filename: `INV-${order.order_number}.pdf`,
        content: Buffer.from(pdfBuffer),
      },
    ],
  })

  // Update order status to 'invoiced' and set invoice_date
  // ...

  return Response.json({ success: true, emailId: data?.id })
}
```

### Pattern 3: Payment Recording via Server Action
**What:** Server action that inserts into payments table and updates order payment_status. Auto-transitions to 'paid' when balance reaches zero.
**When to use:** Inline payment recording from order detail page.
**Example:**
```typescript
// src/app/actions/payments.ts
'use server'

export async function recordPayment(orderId: string, data: unknown) {
  const parsed = paymentSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createClient()
  // ... auth check, tenant check ...

  // Insert payment
  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      tenant_id: tenantId,
      order_id: orderId,
      amount: String(parsed.data.amount),
      payment_date: parsed.data.paymentDate,
    })
    .select()
    .single()

  // Calculate total paid
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('order_id', orderId)

  const totalPaid = payments?.reduce((sum, p) => sum + parseFloat(p.amount), 0) ?? 0
  const carrierPay = parseFloat(order.carrier_pay)

  // Determine new payment status
  let newPaymentStatus: string
  if (totalPaid >= carrierPay) {
    newPaymentStatus = 'paid'
  } else if (totalPaid > 0) {
    newPaymentStatus = 'partially_paid'
  } else {
    newPaymentStatus = 'invoiced'
  }

  // Update order payment_status
  await supabase
    .from('orders')
    .update({ payment_status: newPaymentStatus })
    .eq('id', orderId)

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/billing')
  return { data: payment }
}
```

### Pattern 4: Receivables Query with Broker Aggregation
**What:** Supabase query that groups orders by broker and computes receivables summary.
**When to use:** Receivables dashboard table.
**Example:**
```typescript
// src/lib/queries/receivables.ts
export async function fetchBrokerReceivables(supabase: SupabaseClient) {
  // Use RPC or view for complex aggregation; alternatively, fetch and compute client-side
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, broker_id, carrier_pay, payment_status, invoice_date, broker:brokers(id, name)')
    .in('payment_status', ['invoiced', 'partially_paid'])
    .not('broker_id', 'is', null)

  if (error) throw error

  // Group by broker and compute aggregations
  const brokerMap = new Map<string, BrokerReceivable>()
  for (const order of orders) {
    // ... aggregate total_owed, invoice_count, oldest_unpaid, overdue_amount
  }

  return Array.from(brokerMap.values())
}
```

### Pattern 5: Aging Buckets Computation
**What:** Compute aging buckets (Current, 1-30, 31-60, 61-90, 90+) based on invoice_date.
**When to use:** Aging analysis section of receivables page.
**Key decision:** Calculate based on `invoice_date` (per BIL-3 requirement), not due date.
**Example:**
```typescript
// src/lib/queries/receivables.ts
import { differenceInDays } from 'date-fns'

type AgingBucket = 'current' | '1_30' | '31_60' | '61_90' | '90_plus'

function getAgingBucket(invoiceDate: string): AgingBucket {
  const days = differenceInDays(new Date(), new Date(invoiceDate))
  if (days <= 0) return 'current'
  if (days <= 30) return '1_30'
  if (days <= 60) return '31_60'
  if (days <= 90) return '61_90'
  return '90_plus'
}
```

### Anti-Patterns to Avoid
- **Client-side PDF generation:** Avoid generating PDFs in the browser. Use server-side `renderToBuffer` for consistent output, security (no data exposure), and email attachment capability.
- **Storing PDFs in database:** Don't store generated PDF blobs. Generate on-demand from order data. PDFs are deterministic given the same input data.
- **Single payment status on order without payments table:** The context specifies partial payments. A single field can't track multiple payment records. Always use a separate payments table.
- **Using batch Resend API for invoice emails:** Batch API doesn't support attachments. Loop and send individual emails instead.
- **Mixing order status with payment status:** Keep the existing `order_status` enum (new -> assigned -> picked_up -> delivered -> invoiced -> paid) AND add a separate `payment_status` column. The order status tracks the logistics lifecycle; payment_status tracks the financial lifecycle independently.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | HTML-to-PDF string templates | `@react-pdf/renderer` components | Consistent rendering, no browser dependency, component-based layout, proper font handling |
| Email HTML | Inline HTML strings | `@react-email/components` | Cross-client compatibility (Gmail, Outlook, Apple Mail), responsive, tested components |
| Email delivery | SMTP client / Nodemailer | `resend` SDK | Managed deliverability, simple API, React component support, attachment handling |
| Date difference for aging | Manual date math | `date-fns` `differenceInDays` | Already in project; handles timezones, DST, edge cases correctly |
| Currency formatting | `toFixed(2)` | `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` | Already used in `order-detail.tsx`; handles localization, negative values |

**Key insight:** PDF generation and email delivery have invisible complexity (font rendering, email client quirks, attachment encoding). The established libraries handle thousands of edge cases. The project's pattern of using best-in-class libraries (shadcn, TanStack Query, Drizzle) should continue here.

## Common Pitfalls

### Pitfall 1: Payment Status vs Order Status Confusion
**What goes wrong:** Trying to use the existing `order_status` enum (which includes 'invoiced' and 'paid') as the sole payment tracker, then discovering partial payments break the model.
**Why it happens:** The order status is a linear workflow (new -> assigned -> ... -> paid). Payment status needs to track financial state independently (unpaid -> invoiced -> partially_paid -> paid).
**How to avoid:** Add a separate `payment_status` column on orders. The existing order status advances from 'delivered' to 'invoiced' when an invoice is sent. The `payment_status` tracks the financial balance independently. Both can coexist.
**Warning signs:** If you find yourself unable to represent "order is delivered but partially paid," the model is wrong.

### Pitfall 2: Floating Point Arithmetic for Money
**What goes wrong:** Using JavaScript `number` for financial calculations leads to rounding errors (e.g., `0.1 + 0.2 !== 0.3`).
**Why it happens:** IEEE 754 floating point can't represent many decimal fractions exactly.
**How to avoid:** The existing codebase stores money as `NUMERIC(12,2)` in Postgres (correct) and `string` in TypeScript interfaces (correct). Always `parseFloat()` only at the point of display/calculation, and round results to 2 decimal places. For comparisons (e.g., "is balance zero?"), use threshold: `Math.abs(remaining) < 0.01`.
**Warning signs:** Payment totals that don't add up, balance showing $0.01 remaining after full payment.

### Pitfall 3: Batch Send Without Attachments
**What goes wrong:** Attempting to use `resend.batch.send()` for bulk invoice emails with PDF attachments fails silently or errors out.
**Why it happens:** Resend's batch API explicitly does not support attachments.
**How to avoid:** For batch invoice sending, loop through selected orders and call `resend.emails.send()` individually. Use `Promise.allSettled()` to handle partial failures gracefully. Show progress to user.
**Warning signs:** Planning a "send all" feature that assumes batch API works with attachments.

### Pitfall 4: Missing Tenant Company Info for Invoices
**What goes wrong:** Invoice template needs company name, address, phone but the `tenants` table only has `name`, `slug`, `plan`, and Stripe fields.
**Why it happens:** The tenant table was designed for auth/billing infrastructure, not as a company profile.
**How to avoid:** Add columns to tenants table: `address`, `city`, `state`, `zip`, `phone`. Migration 00004 should include these. Alternatively, create a `tenant_settings` table, but extending `tenants` is simpler and follows the existing pattern.
**Warning signs:** Invoice header showing blank company info or hardcoded placeholder text.

### Pitfall 5: Invoice Date Not Recorded
**What goes wrong:** Aging analysis requires knowing when an invoice was sent, but no `invoice_date` column exists on orders.
**Why it happens:** The order status transition to 'invoiced' exists but doesn't persist the date.
**How to avoid:** Add `invoice_date TIMESTAMPTZ` column to orders. Set it when the "Send Invoice" action fires. Aging buckets calculate `differenceInDays(now, invoice_date)`.
**Warning signs:** Aging buckets that can't be computed because there's no invoice date to measure from.

### Pitfall 6: RLS Policy Gaps on New Tables
**What goes wrong:** New `payments` table is readable by any authenticated user across tenants.
**Why it happens:** Forgetting to add RLS policies on new tables. Every table in this project uses RLS with `tenant_id = get_tenant_id()`.
**How to avoid:** Follow the exact RLS pattern from migration 00003 (trips). Every new table needs: ENABLE RLS, SELECT/INSERT/UPDATE/DELETE policies using `get_tenant_id()`.
**Warning signs:** Any new table without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.

## Code Examples

Verified patterns from the existing codebase and official sources:

### Invoice PDF Template with @react-pdf/renderer
```typescript
// src/lib/pdf/invoice-template.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  companyName: { fontSize: 18, fontWeight: 'bold' },
  invoiceTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
  table: { marginTop: 20 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableRow: { flexDirection: 'row', paddingVertical: 6 },
  col1: { width: '40%' },
  col2: { width: '30%' },
  col3: { width: '30%', textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderColor: '#1a1a1a',
    paddingTop: 8,
    marginTop: 8,
  },
  bold: { fontWeight: 'bold' },
})

interface InvoiceDocumentProps {
  order: OrderWithBroker
  tenant: TenantInfo
}

export function InvoiceDocument({ order, tenant }: InvoiceDocumentProps) {
  const invoiceNumber = `INV-${order.order_number?.replace('ORD-', '') ?? order.id.slice(0, 8)}`

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Company Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{tenant.name}</Text>
            {tenant.address && <Text>{tenant.address}</Text>}
            {tenant.city && <Text>{tenant.city}, {tenant.state} {tenant.zip}</Text>}
            {tenant.phone && <Text>{tenant.phone}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text>{invoiceNumber}</Text>
            <Text>Date: {new Date().toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Bill To */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.bold}>Bill To:</Text>
          <Text>{order.broker?.name ?? 'N/A'}</Text>
          {order.broker?.email && <Text>{order.broker.email}</Text>}
        </View>

        {/* Line Items: VINs, locations, carrier pay */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col1, styles.bold]}>Description</Text>
            <Text style={[styles.col2, styles.bold]}>Details</Text>
            <Text style={[styles.col3, styles.bold]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.col1}>
              {order.vehicle_year} {order.vehicle_make} {order.vehicle_model}
            </Text>
            <Text style={styles.col2}>
              {order.pickup_city}, {order.pickup_state} → {order.delivery_city}, {order.delivery_state}
            </Text>
            <Text style={styles.col3}>
              ${parseFloat(order.carrier_pay).toFixed(2)}
            </Text>
          </View>
          {order.vehicle_vin && (
            <View style={styles.tableRow}>
              <Text style={styles.col1}>VIN: {order.vehicle_vin}</Text>
              <Text style={styles.col2} />
              <Text style={styles.col3} />
            </View>
          )}
        </View>

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={[styles.col1, styles.bold]}>Total Due</Text>
          <Text style={styles.col2} />
          <Text style={[styles.col3, styles.bold]}>
            ${parseFloat(order.carrier_pay).toFixed(2)}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
```

### Resend Client Singleton
```typescript
// src/lib/resend/client.ts
import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)
```

### Invoice Email Template with React Email
```typescript
// src/components/email/invoice-email.tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface InvoiceEmailProps {
  order: { order_number: string; carrier_pay: string }
  tenant: { name: string }
}

export function InvoiceEmail({ order, tenant }: InvoiceEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Invoice from {tenant.name}</Preview>
      <Body style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f9fafb' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
          <Heading>Invoice {`INV-${order.order_number?.replace('ORD-', '')}`}</Heading>
          <Text>Please find attached the invoice for order {order.order_number}.</Text>
          <Section>
            <Text style={{ fontWeight: 'bold' }}>
              Amount Due: ${parseFloat(order.carrier_pay).toFixed(2)}
            </Text>
          </Section>
          <Hr />
          <Text style={{ color: '#6b7280', fontSize: '12px' }}>
            This invoice was sent by {tenant.name}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

### Payment Recording Validation Schema
```typescript
// src/lib/validations/payment.ts
import { z } from 'zod'

export const recordPaymentSchema = z.object({
  amount: z.coerce.number()
    .positive('Amount must be greater than 0')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  notes: z.string().optional().or(z.literal('')),
})

export type RecordPaymentValues = z.infer<typeof recordPaymentSchema>
```

### Database Migration Pattern (following existing 00003 pattern)
```sql
-- src/supabase/migrations/00004_billing_invoicing.sql

-- 1. New payment_status enum
CREATE TYPE public.payment_status AS ENUM (
  'unpaid', 'invoiced', 'partially_paid', 'paid'
);

-- 2. Add billing columns to orders
ALTER TABLE public.orders ADD COLUMN payment_status public.payment_status NOT NULL DEFAULT 'unpaid';
ALTER TABLE public.orders ADD COLUMN invoice_date TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN amount_paid NUMERIC(12,2) DEFAULT 0;

-- 3. Add company info to tenants
ALTER TABLE public.tenants ADD COLUMN address TEXT;
ALTER TABLE public.tenants ADD COLUMN city TEXT;
ALTER TABLE public.tenants ADD COLUMN state TEXT;
ALTER TABLE public.tenants ADD COLUMN zip TEXT;
ALTER TABLE public.tenants ADD COLUMN phone TEXT;

-- 4. Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Indexes
CREATE INDEX idx_orders_tenant_payment_status ON public.orders(tenant_id, payment_status);
CREATE INDEX idx_orders_tenant_invoice_date ON public.orders(tenant_id, invoice_date);
CREATE INDEX idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX idx_payments_order_id ON public.payments(order_id);

-- 6. RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));
-- ... INSERT, UPDATE, DELETE policies following same pattern

-- 7. Triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. Realtime
GRANT SELECT ON public.payments TO supabase_realtime;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTML-to-PDF via Puppeteer | `@react-pdf/renderer` with `renderToBuffer` | 2024+ (v4) | No Chromium dependency; faster; React component model |
| Client-side jsPDF | Server-side `renderToBuffer` | Best practice | Security (no data leakage), consistency, attachment capability |
| SMTP via Nodemailer | Managed email via Resend | 2023+ | No SMTP config; managed deliverability; React template support |
| Raw HTML email strings | `@react-email/components` | 2023+ | Cross-client tested; responsive; component-based |
| `@react-pdf/renderer` incompatible with App Router | Fixed in v4.1.0+ with React 19 | Feb 2025 | `renderToBuffer` works in Next.js route handlers with React 19 |

**Deprecated/outdated:**
- `@react-pdf/renderer` < v4.1.0: Broken with React 19 / Next.js App Router. Use v4.3.2+.
- Resend batch API for attachments: Not supported. Use individual sends.
- Inline HTML email strings: React Email provides tested, cross-client HTML rendering.

## Open Questions

1. **Invoice number format with order_number**
   - What we know: CONTEXT.md says `INV-{order_id}` e.g., `INV-1234`. But `order_id` is a UUID, and `order_number` is `ORD-000123`.
   - What's unclear: Should the invoice number be `INV-000123` (matching the numeric part of order_number) or literally `INV-{uuid}`?
   - Recommendation: Use `INV-{numeric_part_of_order_number}`, e.g., order `ORD-000123` gets invoice `INV-000123`. This is readable and unique within the tenant.

2. **Resend domain verification**
   - What we know: Resend requires a verified domain to send from a custom address. During development, `onboarding@resend.dev` is available.
   - What's unclear: Whether the user has a verified domain configured in Resend.
   - Recommendation: Use environment variable `RESEND_FROM_EMAIL` with a fallback. Document that domain verification is needed for production.

3. **Denormalized `amount_paid` on orders vs computed from payments**
   - What we know: Performance vs consistency tradeoff. Computing from payments table is always accurate; denormalized column is faster for listing queries.
   - What's unclear: Scale expectations (hundreds vs thousands of orders).
   - Recommendation: Add denormalized `amount_paid` on orders (updated on each payment insert) for listing performance, but always verify against payments sum for critical operations (payment recording, status transitions). This follows the existing pattern in trips table where `total_revenue`, `order_count` etc. are denormalized.

4. **Sidebar navigation: "Billing" vs "Invoices"**
   - What we know: The sidebar currently has `{ name: 'Invoices', href: '/invoices', icon: Receipt, minRole: 'admin' }`. CONTEXT.md says a new "Billing" page.
   - What's unclear: Whether to rename the existing sidebar item or change the route.
   - Recommendation: Change the sidebar item to `{ name: 'Billing', href: '/billing', icon: Receipt, minRole: 'admin' }` and create the route at `/billing` as specified in CONTEXT.md. The sidebar already has the Receipt icon allocated.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/db/schema.ts`, `src/app/actions/orders.ts`, `src/hooks/use-orders.ts`, `src/lib/queries/orders.ts` -- verified patterns for server actions, hooks, queries, schema
- Existing codebase: `supabase/migrations/00001-00003` -- verified migration patterns (RLS, indexes, triggers, enums)
- Existing codebase: `src/components/layout/sidebar.tsx` -- sidebar already has "Invoices" nav item with `Receipt` icon
- [React-PDF official docs](https://react-pdf.org/) -- confirmed `renderToBuffer`, `renderToStream` server APIs; component list; v4.x features
- [React-PDF compatibility](https://react-pdf.org/compatibility) -- confirmed React 19 support since v4.1.0
- [Resend Next.js docs](https://resend.com/docs/send-with-nextjs) -- setup, API route pattern, React Email integration
- [Resend Attachments API](https://resend.com/docs/dashboard/emails/attachments) -- `content` (Buffer/base64) and `path` (URL) attachment parameters; 40MB limit
- [Resend Email API reference](https://resend.com/docs/api-reference/emails/send-email) -- full parameter list, attachment structure, idempotency key

### Secondary (MEDIUM confidence)
- [GitHub Issue #3074](https://github.com/diegomura/react-pdf/issues/3074) -- renderToBuffer with Next.js 15+ resolved by upgrading to React 19
- [Resend Batch API docs](https://resend.com/docs/api-reference/emails/send-batch-emails) -- batch supports up to 100 emails, NO attachment support
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) -- v4.3.2, 1.7M weekly downloads, MIT license
- [resend npm](https://www.npmjs.com/package/resend) -- v6.9.2 latest
- [@react-email/components npm](https://www.npmjs.com/package/@react-email/components) -- v1.0.7 latest

### Tertiary (LOW confidence)
- Web search results for PDF generation comparison -- general ecosystem consensus that @react-pdf/renderer is preferred for component-based PDF generation
- Medium articles on invoice generation with react-pdf -- pattern validation but not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `@react-pdf/renderer` confirmed working with React 19 / Next.js 16 via official docs and GitHub issues; Resend API well-documented; all fit existing project patterns
- Architecture: HIGH -- follows exact patterns from phases 1-3 (server actions, route handlers, hooks, queries, migrations with RLS); extends rather than introduces new paradigms
- Pitfalls: HIGH -- payment status vs order status distinction confirmed by codebase analysis; batch attachment limitation confirmed by Resend docs; RLS requirement confirmed by existing migration pattern

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days -- stable domain, well-established libraries)
