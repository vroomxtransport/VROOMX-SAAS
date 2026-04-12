'use server'

/**
 * Account deletion action (N13 — GDPR Art. 17 / CCPA 1798.105).
 *
 * Performs a soft-delete + PII scrub:
 * 1. Verify the user typed "DELETE MY ACCOUNT" as confirmation
 * 2. Cancel Stripe subscription (if active)
 * 3. Nullify PII on tenant (name, phone, address → anonymized)
 * 4. Nullify PII on tenant_memberships (full_name, email)
 * 5. Deactivate all drivers owned by the tenant
 * 6. Ban the Supabase Auth user (prevents re-login)
 * 7. Log audit event
 * 8. Sign out
 *
 * Financial records (orders, payments, invoices) are RETAINED with
 * anonymized tenant name for tax/compliance obligations. This matches
 * GDPR Art. 17(3)(b) — retention for legal obligations.
 *
 * Security rules: authorize('*') + rate limit + service-role for admin ops
 */

import { z } from 'zod'
import { authorize, safeError } from '@/lib/authz'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getStripeClient } from '@/lib/stripe/config'
import { logAuditEvent } from '@/lib/audit-log'
import { deleteAccountSchema } from '@/lib/validations/account'
import { captureAsyncError } from '@/lib/async-safe'

export async function deleteMyAccountAction(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  // 1. Validate confirmation text
  const parsed = deleteAccountSchema.safeParse({
    confirmation: formData.get('confirmation'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid confirmation' }
  }

  // 2. Authorize — any authenticated user can delete their own account
  const auth = await authorize('*', {
    rateLimit: { key: 'delete-account', limit: 3, windowMs: 3600_000 },
    checkSuspension: false, // suspended users should still be able to delete
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  const admin = createServiceRoleClient()

  try {
    // 3. Fetch tenant for Stripe customer ID
    const { data: tenant } = await supabase
      .from('tenants')
      .select('stripe_customer_id, stripe_subscription_id, name')
      .eq('id', tenantId)
      .single()

    // 4. Cancel Stripe subscription (if active)
    if (tenant?.stripe_subscription_id) {
      try {
        const stripe = getStripeClient()
        await stripe.subscriptions.cancel(tenant.stripe_subscription_id, {
          prorate: true,
        })
      } catch (stripeErr) {
        // Log but don't block deletion — Stripe webhook will handle cleanup
        console.error('[account:delete] Stripe cancel failed:', stripeErr)
      }
    }

    const anonymizedName = `Deleted Account ${tenantId.slice(0, 8)}`
    const now = new Date().toISOString()

    // 5. Nullify PII on tenant (service-role bypasses RLS for the update)
    await admin
      .from('tenants')
      .update({
        name: anonymizedName,
        phone: null,
        address: null,
        city: null,
        state: null,
        zip: null,
        dot_number: null,
        mc_number: null,
        is_suspended: true,
        updated_at: now,
      })
      .eq('id', tenantId)

    // 6. Nullify PII on all tenant memberships
    await admin
      .from('tenant_memberships')
      .update({
        full_name: null,
        email: null,
        updated_at: now,
      })
      .eq('tenant_id', tenantId)

    // 7. Deactivate all drivers
    await admin
      .from('drivers')
      .update({
        driver_status: 'inactive',
        email: null,
        phone: null,
        address: null,
        city: null,
        state: null,
        zip: null,
        updated_at: now,
      })
      .eq('tenant_id', tenantId)

    // 8. Scrub driver application PII (SSN last4, DOB, names)
    await admin
      .from('driver_applications')
      .update({
        first_name: null,
        last_name: null,
        email: null,
        phone: null,
        date_of_birth: null,
        ssn_last4: null,
        ssn_encrypted: null,
        license_number: null,
        license_state: null,
        updated_at: now,
      })
      .eq('tenant_id', tenantId)

    // 9. Audit log (before banning — audit uses the user's auth context)
    void logAuditEvent(supabase, {
      tenantId,
      entityType: 'tenant',
      entityId: tenantId,
      action: 'account:deleted',
      description: `Account deleted by user. PII scrubbed, subscription cancelled.`,
      actorId: user.id,
      severity: 'critical',
    }).catch(captureAsyncError('account-delete audit'))

    // 10. Ban the Supabase Auth user (prevents re-login with existing credentials)
    // Also ban all other members of this tenant
    const { data: members } = await admin
      .from('tenant_memberships')
      .select('user_id')
      .eq('tenant_id', tenantId)

    for (const member of members ?? []) {
      await admin.auth.admin.updateUserById(member.user_id, {
        ban_duration: '876000h', // ~100 years
        app_metadata: { tenant_id: null, role: null, deleted: true },
      })
    }

    // 11. Sign out the current user
    await supabase.auth.signOut()

    return { success: true }
  } catch (error) {
    return { error: safeError(error as { message: string }, 'deleteMyAccount') }
  }
}
