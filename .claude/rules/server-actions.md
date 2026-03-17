# Server Actions Pattern – VroomX TMS

EVERY server action MUST follow this exact sequence:

1. Parse input with Zod schema → return field errors if invalid
2. Call authorize(permission, { rateLimit? }) → if !ok, return error
3. Extract { supabase, tenantId } from ctx
4. (If needed) checkTierLimit() or isAccountSuspended()
5. Execute Supabase query with tenant_id filter
6. On error: safeError(error, 'context') → log real, return generic
7. revalidatePath() for cache busting
8. Return { data } or { success: true }

NEVER skip steps 1–3. Use this pattern for consistency and security.