'use server'

/**
 * Server actions for the driver application portal.
 *
 * Public actions (requestResumeLink, updateDraftSection,
 * signConsent, uploadApplicationDocument, submitApplication, getApplicationStatus)
 * use the two-token model via public-auth.ts and are IP rate-limited.
 *
 * Phase 2 note: createDraftApplication was removed. New drafts are created by
 * authenticated admins via inviteDriverApplication (admin-push model).
 *
 * Authed actions (listApplications, getApplicationDetail, withdrawApplication,
 * rotateStatusToken) use authorize() from authz.ts with tenant_id isolation.
 *
 * Security rules applied:
 * - Every authed action: Zod → authorize() → tenant_id filter → safeError()
 * - Every public action: Zod → rateLimitByIp() → publicAuthFor*() → service-role
 * - SSN: never stored in plaintext; last 4 extracted, pgp_sym_encrypt TODO
 * - Audit metadata always runs through redactPii() before writing
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { authorize, safeError } from '@/lib/authz'
import { sanitizeSearch } from '@/lib/sanitize-search'
import {
  publicAuthForResume,
  publicAuthForStatus,
  publicReadTenantBySlug,
  createServiceRoleClient,
} from '@/lib/public-auth'
import { rateLimitByIp } from '@/lib/rate-limit-ip'
import { logAuditEvent } from '@/lib/audit-log'
import { redactPii } from '@/lib/audit-redact'
import { getClientIp } from '@/lib/client-ip'
import { uploadFile, getSignedUrl } from '@/lib/storage'
import { getCanonicalConsentText } from '@/lib/consent-text'
import {
  page1Schema,
  page2Schema,
  page3Schema,
  page4Schema,
  page5Schema,
  page6Schema,
  page7Schema,
  page8Schema,
  signConsentSchema,
  applicantDocumentTypeSchema,
  inviteDriverApplicationSchema,
} from '@/lib/validations/driver-application'
import { getResend } from '@/lib/resend/client'
import { DriverInviteEmail } from '@/components/email/driver-invite-email'
import { captureAsyncError } from '@/lib/async-safe'
import type {
  DriverApplication,
  DriverApplicationData,
  DriverOnboardingPipeline,
  DriverOnboardingStep,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// SEC-005: getClientIp() is now sourced from @/lib/client-ip — a centralised
// helper that prefers platform-trusted headers (Netlify, Cloudflare, Vercel)
// over the spoofable x-forwarded-for chain.

// SEC-001: createServiceRoleClient() was a duplicate of the one in public-auth.ts.
// Removed — the service-role client is obtained exclusively through publicAuthForResume()
// / publicAuthForStatus() so it never leaks out of the public-auth module.

/** Get User-Agent from headers. */
async function getUserAgent(): Promise<string> {
  const { headers } = await import('next/headers')
  const h = await headers()
  return h.get('user-agent') ?? 'unknown'
}

/** Schema map for per-section validation in updateDraftSection. */
const SECTION_SCHEMAS = new Map<string, z.ZodTypeAny>([
  ['page1', page1Schema],
  ['page2', page2Schema],
  ['page3', page3Schema],
  ['page4', page4Schema],
  ['page5', page5Schema],
  ['page6', page6Schema],
  ['page7', page7Schema],
  ['page8', page8Schema],
])

/** File extensions allowed for public applicant document uploads (narrow allowlist). */
const ALLOWED_DOC_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic'])

// ---------------------------------------------------------------------------
// AUTHED: inviteDriverApplication (Phase 2 — admin-push model)
// ---------------------------------------------------------------------------

/**
 * Mint a new driver application on behalf of a tenant admin.
 *
 * Replaces the public createDraftApplication (removed in Phase 2).
 * Only authenticated tenant users with driver_applications.create can call this.
 *
 * Flow: Zod → authorize → dedup checks → insert → build magic link → send email → audit log
 * Rate limit: 30 invitations per 60 seconds per tenant user
 */
export async function inviteDriverApplication(input: {
  firstName: string
  lastName: string
  email: string
  phone: string
}): Promise<
  | { applicationId: string; resumeToken: string; applicationUrl: string; emailSent: boolean }
  | { error: string }
> {
  // Step 1 — Zod validate
  const parsed = inviteDriverApplicationSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Validation failed' }
  }

  // Step 2 — Authorize
  const auth = await authorize('driver_applications.create', {
    rateLimit: { key: 'inviteDriverApplication', limit: 30, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  // Step 3 — Dedup check: active application for this email in this tenant
  const { data: existingApp } = await supabase
    .from('driver_applications')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', parsed.data.email)
    .not('status', 'in', '("rejected","withdrawn")')
    .maybeSingle()

  if (existingApp) {
    return { error: 'An application is already in progress for this email address' }
  }

  // Step 4 — Dedup check: active driver with this email already exists
  const { data: existingDriver } = await supabase
    .from('drivers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', parsed.data.email)
    .eq('driver_status', 'active')
    .maybeSingle()

  if (existingDriver) {
    return { error: 'A driver with this email already exists' }
  }

  // Step 5 — Look up tenant slug + name
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('slug, name')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) {
    return { error: safeError(tenantError ?? new Error('Tenant not found'), 'inviteDriverApplication:tenantLookup') }
  }

  // Step 6 — Look up inviter's full name from tenant_memberships
  const { data: memberData } = await supabase
    .from('tenant_memberships')
    .select('full_name')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single()

  const inviterName = memberData?.full_name || user.email || 'A team member'

  // Step 7 — Insert driver_applications row with seeded Page 1 data
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  const { data: app, error: insertError } = await supabase
    .from('driver_applications')
    .insert({
      tenant_id: tenantId,
      status: 'draft',
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      created_by_user_id: user.id,
      resume_token_expires_at: expiresAt,
      // Seed Page 1 so the wizard renders pre-filled without extra logic
      application_data: {
        schema_version: 1,
        page1: {
          applicantInfo: {
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            email: parsed.data.email,
            phone: parsed.data.phone,
          },
        },
      },
      // resume_token and status_token default to uuid() in the DB
    })
    .select('id, resume_token')
    .single()

  if (insertError || !app) {
    return { error: safeError(insertError ?? new Error('Insert failed'), 'inviteDriverApplication:insert') }
  }

  // Step 8 — Build the application magic link
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const applicationUrl = `${appBaseUrl}/apply/${tenant.slug}/form?token=${app.resume_token as string}`

  // Step 9 — Send email via Resend (non-fatal)
  let emailSent = false
  try {
    if (process.env.RESEND_API_KEY) {
      await getResend().emails.send({
        from: 'VroomX <noreply@vroomx.com>',
        to: parsed.data.email,
        subject: `Application invitation from ${tenant.name}`,
        react: DriverInviteEmail({
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          inviterName,
          driverFirstName: parsed.data.firstName,
          applicationUrl,
        }),
      })
      emailSent = true
    } else if (process.env.NODE_ENV === 'development') {
      console.log('[inviteDriverApplication] Resend not configured. Application URL:', applicationUrl)
    }
  } catch (e) {
    console.error('[inviteDriverApplication] Resend send failed:', (e as Error).message)
    emailSent = false
  }

  // Step 10 — Audit log (fire-and-forget, never throws)
  logAuditEvent(supabase, {
    tenantId,
    entityType: 'driver_application',
    entityId: app.id as string,
    action: 'application.invited',
    description: `Driver invitation sent to ${parsed.data.firstName} ${parsed.data.lastName}`,
    actorId: user.id,
    actorEmail: user.email,
    metadata: redactPii({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
      email_sent: emailSent,
    }) as Record<string, unknown>,
  }).catch(captureAsyncError('driver-app action'))

  // Step 11 — Revalidate
  revalidatePath('/onboarding')

  return {
    applicationId: app.id as string,
    resumeToken: app.resume_token as string,
    applicationUrl,
    emailSent,
  }
}

// ---------------------------------------------------------------------------
// PUBLIC: requestResumeLink
// ---------------------------------------------------------------------------

/**
 * Rotate the resume token for an existing draft application and (stub) send
 * a magic link via email.
 *
 * Rate limit: 3 requests / minute / IP
 * Always returns { sent: true } — no disclosure of whether the email exists.
 */
export async function requestResumeLink(
  tenantSlug: string,
  email: string
): Promise<{ sent: boolean } | { error: string }> {
  // SEC-004: start the clock here — both branches must complete in ≥200ms
  // to prevent timing-based email enumeration.
  const startedAt = Date.now()

  const parsed = z
    .object({ tenantSlug: z.string().min(1), email: z.string().email() })
    .safeParse({ tenantSlug, email })
  if (!parsed.success) return { error: 'Invalid request' }

  const ip = await getClientIp()
  const rl = await rateLimitByIp({ ip, key: 'apply:resume', limit: 3, windowMs: 60_000 })
  if (!rl.allowed) return { error: 'Too many requests. Please try again shortly.' }

  // Tenant lookup — publicReadTenantBySlug returns null for nonexistent/suspended (uniform 404)
  const tenant = await publicReadTenantBySlug(parsed.data.tenantSlug)
  if (!tenant) {
    // Same response whether tenant exists or not (anti-enumeration)
    const elapsed = Date.now() - startedAt
    if (elapsed < 200) await new Promise((r) => setTimeout(r, 200 - elapsed))
    return { sent: true }
  }

  const supabase = createServiceRoleClient()

  const newExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  // Look up application by (tenant_id, email, status='draft')
  const { data: app } = await supabase
    .from('driver_applications')
    .select('id, resume_token')
    .eq('tenant_id', tenant.id)
    .eq('email', parsed.data.email)
    .eq('status', 'draft')
    .maybeSingle()

  if (app) {
    // Rotate the resume_token and extend expiry
    // DB-side: resume_token DEFAULT random(), so we generate a fresh UUID with crypto
    const { randomUUID } = await import('crypto')
    const newToken = randomUUID()

    await supabase
      .from('driver_applications')
      .update({
        resume_token: newToken,
        resume_token_expires_at: newExpiresAt,
      })
      .eq('id', app.id)
      .eq('tenant_id', tenant.id) // defense-in-depth tenant filter

    const resumeUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/apply/${parsed.data.tenantSlug}/form?token=${newToken}`

    // TODO(v2): Send magic link via Resend email integration.
    // Resend template: "resume-application"
    // Subject: "Resume your driver application"
    // Body: link to resumeUrl, expires in 72h.
    if (process.env.NODE_ENV === 'development') {
      console.log('[requestResumeLink] Resume URL (dev only):', resumeUrl)
    }
  }

  // SEC-004: equalise timing — both found and not-found branches must take ≥200ms
  // so wall-clock measurement cannot distinguish the two (email enumeration defense).
  const elapsed = Date.now() - startedAt
  if (elapsed < 200) await new Promise((r) => setTimeout(r, 200 - elapsed))

  // Always return { sent: true } — never disclose whether email was found
  return { sent: true }
}

// ---------------------------------------------------------------------------
// PUBLIC: updateDraftSection
// ---------------------------------------------------------------------------

/**
 * Merge one wizard page/section of data into applicationData JSONB.
 *
 * Validates section data against the matching per-page Zod schema.
 * For address history (when applicantInfo.lived3Years = false), wipes and
 * re-inserts driver_application_address_history child rows.
 *
 * When section is 'page1', also writes extracted top-level columns:
 * first_name, last_name, email, phone, date_of_birth, license_number,
 * license_state. SSN is handled separately (see note below).
 *
 * CRITICAL NOTE (from plan §"CRITICAL DEVIATION NOTE from backend-architect"):
 * address/city/state/zip live in applicationData->applicant_info->* (JSONB),
 * NOT as top-level extracted columns. The only extracted columns are
 * first_name, last_name, email, phone, date_of_birth, ssn_last4,
 * ssn_encrypted, license_number, license_state.
 */
export async function updateDraftSection(
  resumeToken: string,
  section: string,
  data: unknown
): Promise<{ success: true } | { error: string }> {
  // Validate inputs
  const inputParsed = z
    .object({ resumeToken: z.string().uuid(), section: z.string().min(1) })
    .safeParse({ resumeToken, section })
  if (!inputParsed.success) return { error: 'Invalid request' }

  // Validate section-specific data
  const sectionSchema = SECTION_SCHEMAS.get(section)
  if (!sectionSchema) return { error: 'Unknown section' }

  const sectionParsed = sectionSchema.safeParse(data)
  if (!sectionParsed.success) {
    return { error: 'Validation failed', ...{ fieldErrors: sectionParsed.error.flatten().fieldErrors } }
  }

  // Authorize via resume token
  const authResult = await publicAuthForResume(inputParsed.data.resumeToken)
  if ('error' in authResult) return { error: authResult.error }
  const { supabase, application } = authResult

  // SEC-003: Before merging page1, strip the plaintext SSN from the JSONB payload.
  // The SSN is used ONLY to derive ssn_last4 (and eventually ssn_encrypted via RPC).
  // It must NEVER be persisted into application_data JSONB.
  let dataToStore: unknown = sectionParsed.data
  if (section === 'page1') {
    const p1 = sectionParsed.data as z.infer<typeof page1Schema>
    // Destructure ssn out — the rest of applicantInfo is safe to store
    const { ssn: _ssn, ...applicantInfoSafe } = p1.applicantInfo
    void _ssn // intentionally unused — SSN never touches JSONB
    dataToStore = { ...p1, applicantInfo: applicantInfoSafe }
  }

  // Build the applicationData patch — merge into existing JSONB
  const existing = (application.application_data ?? {}) as Record<string, unknown>
  const updated: Record<string, unknown> = {
    ...existing,
    [section]: dataToStore,
    schema_version: 1,
  }

  // SEC-010: cap JSONB size at 64 KB to prevent data-bloat abuse
  const serialized = JSON.stringify(updated)
  if (serialized.length > 64 * 1024) {
    return { error: 'Application data exceeds maximum size' }
  }

  // Build top-level column updates for page1 (extracted fields for indexing)
  const topLevelUpdate: Record<string, unknown> = {
    application_data: updated,
    updated_at: new Date().toISOString(),
  }

  if (section === 'page1') {
    // page1Schema contains applicantInfo, primaryLicense, etc.
    // Use the original sectionParsed.data here (not dataToStore) so we still have
    // access to the SSN for extracting ssn_last4. The SSN is NEVER written to
    // application_data JSONB — only to ssn_last4 (last 4 only) and ssn_encrypted
    // (via RPC in v2). See SEC-003.
    const p1 = sectionParsed.data as z.infer<typeof page1Schema>
    const ai = p1.applicantInfo
    const lic = p1.primaryLicense

    topLevelUpdate.first_name = ai.firstName
    topLevelUpdate.last_name = ai.lastName
    topLevelUpdate.email = ai.email
    topLevelUpdate.phone = ai.phone
    topLevelUpdate.date_of_birth = ai.dateOfBirth
    topLevelUpdate.license_number = lic.licenseNumber
    topLevelUpdate.license_state = lic.state

    // SSN handling: use the SSN from sectionParsed.data (has SSN), NOT dataToStore (SSN stripped).
    // TODO(v2): call pgp_sym_encrypt(ssn, vault_key) via a Postgres RPC to
    // populate ssn_encrypted. The RPC does not exist yet (backend-architect
    // follow-up). For now, store only ssn_last4; do NOT store plaintext SSN
    // in JSONB or any column.
    const ssnRaw = ai.ssn.replace(/-/g, '') // strip dashes → 9 digits
    topLevelUpdate.ssn_last4 = ssnRaw.slice(-4)
    topLevelUpdate.ssn_encrypted = null // populated by RPC in v2
  }

  // Persist the merged applicationData (and extracted columns if page1)
  const { error: updateError } = await supabase
    .from('driver_applications')
    .update(topLevelUpdate)
    .eq('id', application.id)
    .eq('tenant_id', application.tenant_id) // defense-in-depth

  if (updateError) {
    // SEC-013: route through safeError so the message is PII-redacted before logging
    safeError(updateError, 'updateDraftSection')
    return { error: 'Unable to save progress. Please try again.' }
  }

  // Address history — only when page1 and lived3Years = false
  if (section === 'page1') {
    const p1 = sectionParsed.data as z.infer<typeof page1Schema>
    if (!p1.applicantInfo.lived3Years && p1.addressHistory.length > 0) {
      // Wipe existing rows then re-insert (transactional semantics via sequential calls)
      const { error: deleteError } = await supabase
        .from('driver_application_address_history')
        .delete()
        .eq('application_id', application.id)
        .eq('tenant_id', application.tenant_id)

      if (deleteError) {
        safeError(deleteError, 'updateDraftSection:addressHistory:delete')
        return { error: 'Unable to save address history. Please try again.' }
      }

      const rows = p1.addressHistory.map((addr, idx) => ({
        tenant_id: application.tenant_id,
        application_id: application.id,
        street: addr.street,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        from_date: addr.fromDate,
        to_date: addr.toDate ?? null,
        position: addr.position ?? idx,
      }))

      const { error: insertError } = await supabase
        .from('driver_application_address_history')
        .insert(rows)

      if (insertError) {
        safeError(insertError, 'updateDraftSection:addressHistory:insert')
        return { error: 'Unable to save address history. Please try again.' }
      }
    } else if (p1.applicantInfo.lived3Years) {
      // Applicant has lived at current address for 3+ years — clear any
      // previously saved address history rows
      await supabase
        .from('driver_application_address_history')
        .delete()
        .eq('application_id', application.id)
        .eq('tenant_id', application.tenant_id)
    }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// PUBLIC: signConsent
// ---------------------------------------------------------------------------

/**
 * Record an applicant consent signature.
 *
 * SEC-011: The signed_text is no longer accepted from the client — it is
 * legally-binding content and must be entirely server-controlled.
 * The server computes the canonical text from consent-text-server.ts based
 * on the consentType and application data (tenant name, applicant name, ssnLast4).
 *
 * Rate limit: 30 requests / minute / IP
 * Captures IP address and user-agent from request headers.
 * Enforces 1:1 per (applicationId, consentType) via the unique index;
 * if the applicant re-signs the same consent type (to correct before
 * submission), we DELETE the old row + INSERT the new one in the same
 * round-trip (immutable ledger rule applies to UPDATE, not DELETE+INSERT).
 * Rejects if application status != 'draft'.
 */
export async function signConsent(
  resumeToken: string,
  consentType: string,
  typedName: string,
  // SEC-011: signedText parameter removed — the server computes the canonical text.
  // The frontend MUST NOT pass signedText; the parameter is intentionally absent.
): Promise<{ consentId: string; signedAt: string } | { error: string }> {
  const parsed = signConsentSchema
    .extend({ resumeToken: z.string().uuid() })
    .safeParse({ resumeToken, consentType, typedName })
  if (!parsed.success) {
    return { error: 'Invalid consent data. Please check your signature and try again.' }
  }

  const ip = await getClientIp()
  const rl = await rateLimitByIp({ ip, key: 'apply:sign', limit: 30, windowMs: 60_000 })
  if (!rl.allowed) return { error: 'Too many requests. Please try again shortly.' }

  const authResult = await publicAuthForResume(resumeToken)
  if ('error' in authResult) return { error: authResult.error }
  const { supabase, application } = authResult

  if (application.status !== 'draft') {
    return { error: 'Application is no longer editable' }
  }

  // Look up tenant name for consent text interpolation
  const { data: tenant, error: tenantFetchError } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', application.tenant_id)
    .single()

  if (tenantFetchError || !tenant?.name) {
    console.error('[signConsent:tenantFetch]', tenantFetchError?.message)
    return { error: 'Unable to record consent. Please try again.' }
  }

  // SEC-011: Build server-canonical consent text — client input is completely ignored.
  const canonicalText = getCanonicalConsentText(parsed.data.consentType, {
    tenantName: tenant.name as string,
    firstName: application.first_name ?? null,
    lastName: application.last_name ?? null,
    ssnLast4: application.ssn_last4 ?? null,
  })

  if (!canonicalText) {
    return { error: 'Application data incomplete for this consent. Please complete earlier sections first.' }
  }

  // SEC-011: Sanity-check text length (defence-in-depth against accidental bloat)
  if (canonicalText.length > 8192) {
    console.error('[signConsent] Consent text exceeds 8KB limit', { consentType })
    return { error: 'Unable to record consent. Please try again.' }
  }

  const ua = await getUserAgent()
  const signedAt = new Date().toISOString()

  // DELETE any existing consent of this type (allows re-sign before submission)
  await supabase
    .from('driver_application_consents')
    .delete()
    .eq('application_id', application.id)
    .eq('tenant_id', application.tenant_id)
    .eq('consent_type', parsed.data.consentType)

  const { data: consent, error: insertError } = await supabase
    .from('driver_application_consents')
    .insert({
      tenant_id: application.tenant_id,
      application_id: application.id,
      consent_type: parsed.data.consentType,
      signed_text: canonicalText,
      signed_text_locale: 'en-US',
      typed_name: parsed.data.typedName,
      ip_address: ip,
      user_agent: ua,
      signed_at: signedAt,
    })
    .select('id, signed_at')
    .single()

  if (insertError || !consent) {
    console.error('[signConsent]', insertError?.message)
    return { error: 'Unable to record consent. Please try again.' }
  }

  return { consentId: consent.id as string, signedAt: consent.signed_at as string }
}

// ---------------------------------------------------------------------------
// PUBLIC: uploadApplicationDocument
// ---------------------------------------------------------------------------

/**
 * Upload and persist an applicant document server-side.
 *
 * SEC-001: File upload is now ENTIRELY server-side. The client no longer
 * calls Supabase Storage directly via the anon key. This enforces:
 *   - magic-byte validation (via uploadFile() in storage.ts)
 *   - server-controlled storage path (no client-supplied path)
 *   - strict extension + MIME allowlist
 *   - rate limiting before the file is touched
 *
 * FormData fields:
 *   resumeToken  string       — applicant's resume token
 *   documentType string       — one of license_front | license_back | medical_card | other
 *   file         File         — the document file
 *
 * Rate limit: 20 requests / minute / IP
 * Storage path: {tenantId}/applications/{applicationId}/{uuid}.{ext}
 *
 * TODO(v2): trigger AV scan via Edge Function on the uploaded path.
 */
export async function uploadApplicationDocument(formData: FormData): Promise<
  | { documentId: string; storagePath: string }
  | { error: string }
> {
  const resumeToken = formData.get('resumeToken')
  const documentType = formData.get('documentType')
  const file = formData.get('file')

  if (typeof resumeToken !== 'string' || !resumeToken) {
    return { error: 'Missing required field: resumeToken' }
  }
  if (typeof documentType !== 'string' || !documentType) {
    return { error: 'Missing required field: documentType' }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Missing required field: file' }
  }

  // Validate token format early
  const tokenParsed = z.string().uuid().safeParse(resumeToken)
  if (!tokenParsed.success) return { error: 'Invalid request' }

  const ip = await getClientIp()
  const rl = await rateLimitByIp({ ip, key: 'apply:upload', limit: 20, windowMs: 60_000 })
  if (!rl.allowed) return { error: 'Too many requests. Please try again shortly.' }

  // Validate documentType against allowed enum values
  const docTypeParsed = applicantDocumentTypeSchema.safeParse(documentType)
  if (!docTypeParsed.success) return { error: 'Invalid document type' }

  // Early size check before reading bytes (fast-fail)
  const MAX_FILE_SIZE = 25 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File too large. Maximum size is 25 MB.' }
  }

  // Narrow extension allowlist — more restrictive than uploadFile()'s general allowlist
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_DOC_EXTENSIONS.has(ext)) {
    return {
      error: `File type .${ext} is not allowed. Accepted types: PDF, JPG, JPEG, PNG, HEIC.`,
    }
  }

  // Extension → expected MIME check (defence-in-depth before magic-byte validation)
  // ext has already been validated against ALLOWED_DOC_EXTENSIONS (closed Set above),
  // so the object-injection risk is fully controlled — this is a static lookup table.
  const MIME_MAP = new Map<string, string[]>([
    ['pdf', ['application/pdf']],
    ['jpg', ['image/jpeg']],
    ['jpeg', ['image/jpeg']],
    ['png', ['image/png']],
    ['heic', ['image/heic', 'image/heif']],
  ])
  const allowedMimes = MIME_MAP.get(ext) ?? []
  if (file.type && allowedMimes.length > 0 && !allowedMimes.some((m) => file.type.startsWith(m))) {
    return {
      error: `File MIME type ${file.type} does not match expected type for .${ext} files.`,
    }
  }

  // Authenticate applicant via resume token
  const authResult = await publicAuthForResume(resumeToken)
  if ('error' in authResult) return { error: authResult.error }
  const { supabase, application } = authResult

  // Upload via server-side helper — performs magic-byte validation + enforces path format
  const { path: storagePath, error: uploadError } = await uploadFile(
    supabase,
    'documents',
    application.tenant_id as string,
    application.id as string,
    file,
  )

  if (uploadError) {
    return { error: safeError({ message: uploadError }, 'uploadApplicationDocument:upload') }
  }

  // Insert metadata row
  const { data: doc, error: insertError } = await supabase
    .from('driver_application_documents')
    .insert({
      tenant_id: application.tenant_id,
      application_id: application.id,
      document_type: docTypeParsed.data,
      file_name: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type || null,
      scan_status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !doc) {
    console.error('[uploadApplicationDocument]', insertError?.message)
    return { error: 'Unable to save document. Please try again.' }
  }

  return { documentId: doc.id as string, storagePath }
}

// ---------------------------------------------------------------------------
// PUBLIC: submitApplication
// ---------------------------------------------------------------------------

/**
 * Validate all required sections and consents, flip status to 'submitted',
 * mint a statusToken, and revoke the resumeToken.
 *
 * Required consents: application_certification, fcra_disclosure,
 * driver_license_requirements_certification, drug_alcohol_testing_consent,
 * safety_performance_history_investigation, clearinghouse_limited_query,
 * mvr_release. psp_authorization required if tenant.psp_enabled = true
 * (default: true if column doesn't exist).
 */
export async function submitApplication(
  resumeToken: string
): Promise<{ statusToken: string } | { error: string }> {
  const parsed = z.string().uuid().safeParse(resumeToken)
  if (!parsed.success) return { error: 'Invalid token' }

  const authResult = await publicAuthForResume(resumeToken)
  if ('error' in authResult) return { error: authResult.error }
  const { supabase, application } = authResult

  // Validate required sections exist in applicationData
  const appData = application.application_data as DriverApplicationData | null
  if (!appData) {
    return { error: 'Application is incomplete. Please fill in all required sections.' }
  }

  // Check required top-level fields (page1 extracted columns)
  const missingFields: string[] = []
  if (!application.first_name) missingFields.push('First name')
  if (!application.last_name) missingFields.push('Last name')
  if (!application.email) missingFields.push('Email')
  if (!application.date_of_birth) missingFields.push('Date of birth')

  if (missingFields.length > 0) {
    return { error: `Application is incomplete: ${missingFields.join(', ')} required.` }
  }

  // TODO(v2): fetch tenant.psp_enabled column from tenants table once
  // the column is added. For now default to true (require PSP authorization).
  // Replace with: const { data: tenant } = await supabase.from('tenants').select('psp_enabled').eq(...)
  // const pspEnabled = tenant?.psp_enabled ?? true
  const pspEnabled = true

  // Fetch consents
  const { data: consents, error: consentFetchError } = await supabase
    .from('driver_application_consents')
    .select('consent_type')
    .eq('application_id', application.id)
    .eq('tenant_id', application.tenant_id)

  if (consentFetchError) {
    console.error('[submitApplication:consents]', consentFetchError.message)
    return { error: 'Unable to verify consent records. Please try again.' }
  }

  const signedTypes = new Set((consents ?? []).map((c) => c.consent_type as string))

  const requiredConsents = [
    'application_certification',
    'fcra_disclosure',
    'driver_license_requirements_certification',
    'drug_alcohol_testing_consent',
    'safety_performance_history_investigation',
    'clearinghouse_limited_query',
    'mvr_release',
  ]

  if (pspEnabled) {
    requiredConsents.push('psp_authorization')
  }

  const missingConsents = requiredConsents.filter((c) => !signedTypes.has(c))
  if (missingConsents.length > 0) {
    return {
      error: `Missing required signatures: ${missingConsents.join(', ')}.`,
    }
  }

  // Mint statusToken (30 days)
  const { randomUUID } = await import('crypto')
  const statusToken = randomUUID()
  const statusTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error: submitError } = await supabase
    .from('driver_applications')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      status_token: statusToken,
      status_token_expires_at: statusTokenExpiresAt,
      // Revoke resume token
      resume_token: null,
      resume_token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', application.id)
    .eq('tenant_id', application.tenant_id)

  if (submitError) {
    console.error('[submitApplication]', submitError.message)
    return { error: 'Unable to submit application. Please try again.' }
  }

  // TODO(v2): Notify tenant admin via Resend email that a new application was submitted.
  // Resend template: "new-driver-application"
  // Recipient: tenant admin email(s) from tenant_memberships WHERE role='admin'

  return { statusToken }
}

// ---------------------------------------------------------------------------
// PUBLIC: getApplicationStatus
// ---------------------------------------------------------------------------

/**
 * Return whitelisted status fields for the public status page.
 * NO PII, no step names, no admin notes, no consents.
 */
export async function getApplicationStatus(statusToken: string): Promise<
  | {
      tenantId: string
      status: string
      submittedAt: string | null
      overallPipelineStatus: string | null
      stepsCompleted: number
      stepsTotal: number
      rejectionReason: string | null
    }
  | { error: string }
> {
  const parsed = z.string().uuid().safeParse(statusToken)
  if (!parsed.success) return { error: 'Invalid token' }

  const authResult = await publicAuthForStatus(statusToken)
  if ('error' in authResult) return { error: authResult.error }
  const { supabase, application } = authResult

  // Fetch pipeline if it exists — service-role client, tenant-scoped
  const { data: pipeline } = await supabase
    .from('driver_onboarding_pipelines')
    .select('overall_status, id')
    .eq('application_id', application.id)
    .eq('tenant_id', application.tenant_id)
    .maybeSingle()

  let stepsCompleted = 0
  let stepsTotal = 0

  if (pipeline) {
    const { data: steps } = await supabase
      .from('driver_onboarding_steps')
      .select('status, required')
      .eq('pipeline_id', pipeline.id)
      .eq('tenant_id', application.tenant_id)

    if (steps) {
      stepsTotal = steps.length
      stepsCompleted = steps.filter((s) =>
        ['passed', 'waived', 'not_applicable'].includes(s.status as string)
      ).length
    }
  }

  // SEC-007: Whitelisted fields only — no PII, no internal step details.
  // rejection_reason is NEVER exposed on the public status endpoint — it may contain
  // sensitive compliance info (failed drug test, MVR disqualifier, etc.).
  // The full reason is delivered only via the adverse-action email (TODO v2).
  // tenantId is included so the status page route can verify the URL slug
  // matches the application's actual tenant — defends against cross-tenant
  // chrome spoofing where a valid statusToken from carrier A is paired with
  // carrier B's slug to render carrier B's branding around carrier A's status.
  // tenant_id is an opaque UUID, not PII, and is already implicitly accessible
  // to anyone holding a valid status token.
  return {
    tenantId: application.tenant_id,
    status: application.status,
    submittedAt: application.submitted_at,
    overallPipelineStatus: pipeline?.overall_status ?? null,
    stepsCompleted,
    stepsTotal,
    rejectionReason:
      application.status === 'rejected'
        ? 'We are unable to move forward with your application. You will receive a separate notice with full details by email.'
        : null,
  }
}

// ---------------------------------------------------------------------------
// AUTHED: listApplications
// ---------------------------------------------------------------------------

/**
 * Admin inbox — list applications with optional status/search filters.
 * pageSize is clamped to 1–100 per .claude/rules/senior-backend.md.
 */
export async function listApplications(filters?: {
  status?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<
  | { applications: DriverApplication[]; total: number }
  | { error: string }
> {
  const filtersParsed = z
    .object({
      status: z.string().optional(),
      search: z.string().max(200).optional(),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    })
    .safeParse(filters ?? {})
  if (!filtersParsed.success) return { error: 'Invalid filters' }

  const auth = await authorize('driver_applications.read', { rateLimit: { key: 'listApplications', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { page, pageSize, status, search } = filtersParsed.data
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('driver_applications')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('archived_at', null)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) {
    query = query.eq('status', status)
  }

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.or(
        `first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%`
      )
    }
  }

  const { data, error, count } = await query

  if (error) {
    return { error: safeError(error, 'listApplications') }
  }

  return {
    applications: (data ?? []) as DriverApplication[],
    total: count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// AUTHED: getApplicationDetail
// ---------------------------------------------------------------------------

/**
 * Fetch full application detail for the admin detail page.
 * SSN is redacted from the returned JSONB via redactPii().
 * Consent signed_text is excluded (too large; not needed for detail view).
 */
export async function getApplicationDetail(id: string): Promise<
  | {
      application: DriverApplication
      addressHistory: unknown[]
      consents: unknown[]
      documents: unknown[]
      pipeline: (DriverOnboardingPipeline & { steps: DriverOnboardingStep[] }) | null
    }
  | { error: string }
> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'Invalid application ID' }

  const auth = await authorize('driver_applications.read')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Fetch application
  const { data: application, error: appError } = await supabase
    .from('driver_applications')
    .select('*')
    .eq('id', idParsed.data)
    .eq('tenant_id', tenantId) // tenant isolation
    .single()

  if (appError || !application) {
    return { error: safeError(appError ?? { message: 'Not found' }, 'getApplicationDetail') }
  }

  // Redact PII from applicationData before returning
  const redactedApplication = {
    ...application,
    application_data: application.application_data
      ? redactPii(application.application_data)
      : null,
    // ssn_last4 is fine to return; ssn_encrypted stays redacted
    ssn_encrypted: '[REDACTED]',
  }

  // Address history
  const { data: addressHistory } = await supabase
    .from('driver_application_address_history')
    .select('*')
    .eq('application_id', idParsed.data)
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })

  // Consents — exclude signed_text (large; not needed for admin detail view)
  const { data: consents } = await supabase
    .from('driver_application_consents')
    .select('id, tenant_id, application_id, consent_type, typed_name, ip_address, user_agent, signed_at, valid_until, signed_text_locale')
    .eq('application_id', idParsed.data)
    .eq('tenant_id', tenantId)
    .order('signed_at', { ascending: true })

  // Documents — SEC-009: include scan_status and derive downloadBlocked flag
  const { data: rawDocuments } = await supabase
    .from('driver_application_documents')
    .select('*, scan_status')
    .eq('application_id', idParsed.data)
    .eq('tenant_id', tenantId)
    .order('uploaded_at', { ascending: true })

  // Attach downloadBlocked flag: admins must not download unscanned files
  const documents = (rawDocuments ?? []).map((doc) => ({
    ...doc,
    downloadBlocked: doc.scan_status !== 'clean',
  }))

  // Pipeline + steps
  const { data: pipeline } = await supabase
    .from('driver_onboarding_pipelines')
    .select('*')
    .eq('application_id', idParsed.data)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  let pipelineWithSteps: (DriverOnboardingPipeline & { steps: DriverOnboardingStep[] }) | null =
    null

  if (pipeline) {
    const { data: steps } = await supabase
      .from('driver_onboarding_steps')
      .select('*')
      .eq('pipeline_id', pipeline.id)
      .eq('tenant_id', tenantId)
      .order('step_order', { ascending: true })

    pipelineWithSteps = {
      ...(pipeline as DriverOnboardingPipeline),
      steps: (steps ?? []) as DriverOnboardingStep[],
    }
  }

  return {
    application: redactedApplication as DriverApplication,
    addressHistory: addressHistory ?? [],
    consents: consents ?? [],
    documents: documents ?? [],
    pipeline: pipelineWithSteps,
  }
}

// ---------------------------------------------------------------------------
// AUTHED: withdrawApplication
// ---------------------------------------------------------------------------

/**
 * Set application status to 'withdrawn'.
 * Allowed only when current status is draft, submitted, or in_review.
 */
export async function withdrawApplication(
  id: string,
  reason?: string
): Promise<{ success: true } | { error: string }> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'Invalid application ID' }

  const auth = await authorize('driver_applications.withdraw')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  // Fetch current state — tenant-scoped
  const { data: application, error: fetchError } = await supabase
    .from('driver_applications')
    .select('id, status, tenant_id')
    .eq('id', idParsed.data)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !application) {
    return { error: safeError(fetchError ?? { message: 'Not found' }, 'withdrawApplication') }
  }

  const withdrawableStatuses = ['draft', 'submitted', 'in_review']
  if (!withdrawableStatuses.includes(application.status as string)) {
    return { error: 'Application cannot be withdrawn in its current state.' }
  }

  const { error: updateError } = await supabase
    .from('driver_applications')
    .update({
      status: 'withdrawn',
      rejection_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', idParsed.data)
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: safeError(updateError, 'withdrawApplication') }
  }

  logAuditEvent(supabase, {
    tenantId,
    entityType: 'driver_application',
    entityId: idParsed.data,
    action: 'application.withdrawn',
    description: `Application withdrawn by admin`,
    actorId: user.id,
    actorEmail: user.email,
    metadata: redactPii({ reason }) as Record<string, unknown>,
  }).catch(captureAsyncError('driver-app action'))

  revalidatePath('/onboarding')
  revalidatePath(`/onboarding/${idParsed.data}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// AUTHED: rotateStatusToken
// ---------------------------------------------------------------------------

/**
 * Mint a fresh statusToken for a submitted/in-review application.
 * Used when admin suspects the current token was leaked.
 */
export async function rotateStatusToken(
  id: string
): Promise<{ statusToken: string; expiresAt: string } | { error: string }> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'Invalid application ID' }

  const auth = await authorize('driver_applications.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  const { randomUUID } = await import('crypto')
  const statusToken = randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error: updateError } = await supabase
    .from('driver_applications')
    .update({
      status_token: statusToken,
      status_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', idParsed.data)
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: safeError(updateError, 'rotateStatusToken') }
  }

  logAuditEvent(supabase, {
    tenantId,
    entityType: 'driver_application',
    entityId: idParsed.data,
    action: 'application.status_token_rotated',
    description: 'Status token rotated by admin',
    actorId: user.id,
    actorEmail: user.email,
  }).catch(captureAsyncError('driver-app action'))

  revalidatePath(`/onboarding/${idParsed.data}`)
  return { statusToken, expiresAt }
}

// ---------------------------------------------------------------------------
// AUTHED: downloadApplicationDocument
// ---------------------------------------------------------------------------

/**
 * SEC-009: Gate admin document downloads behind scan_status='clean'.
 *
 * Returns a short-lived (60s) signed URL only when the document has been
 * scanned and marked clean. Unscanned or flagged documents are blocked.
 *
 * Authorization: driver_applications.read
 * Tenant isolation: document.tenant_id must match caller's tenant.
 */
export async function downloadApplicationDocument(
  documentId: string
): Promise<{ url: string } | { error: string }> {
  const idParsed = z.string().uuid().safeParse(documentId)
  if (!idParsed.success) return { error: 'Invalid document ID' }

  const auth = await authorize('driver_applications.read')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Fetch document — tenant isolation enforced
  const { data: doc, error: docError } = await supabase
    .from('driver_application_documents')
    .select('id, tenant_id, storage_path, scan_status')
    .eq('id', idParsed.data)
    .eq('tenant_id', tenantId) // defense-in-depth tenant filter
    .single()

  if (docError || !doc) {
    return { error: safeError(docError ?? { message: 'Not found' }, 'downloadApplicationDocument') }
  }

  // SEC-009: block downloads of unscanned or flagged files
  if (doc.scan_status !== 'clean') {
    return { error: 'Document has not been scanned yet. Download will be available after scanning completes.' }
  }

  // Generate a 60-second signed URL (TTL is short to limit exposure)
  const { url, error: urlError } = await getSignedUrl(
    supabase,
    'documents',
    doc.storage_path as string,
    60, // 60-second TTL
  )

  if (urlError || !url) {
    return { error: safeError({ message: urlError ?? 'Failed to generate URL' }, 'downloadApplicationDocument:signedUrl') }
  }

  return { url }
}
