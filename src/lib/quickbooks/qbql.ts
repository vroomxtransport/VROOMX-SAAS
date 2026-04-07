/**
 * QuickBooks Query Language (QBQL) input validators.
 *
 * QBQL queries are constructed as plain strings sent via URL query params to
 * the QB API. There is no parameterization, so all interpolated values MUST
 * be validated to a strict whitelist before construction. These helpers
 * enforce that whitelist at the input boundary.
 *
 * Used by:
 * - src/app/api/webhooks/quickbooks/route.ts (entity.id from webhook payload)
 * - src/lib/quickbooks/client.ts (findCustomerByName, findVendorByName)
 */

import { z } from 'zod'

/**
 * QB entity IDs are numeric strings (1-20 digits).
 * Reference: QB API uses int64 for entity IDs but represents them as strings
 * in JSON to avoid JS number precision loss.
 */
export const qbIdSchema = z
  .string()
  .min(1, 'QB ID must not be empty')
  .max(20, 'QB ID must be at most 20 digits')
  .regex(/^[0-9]+$/, 'QB ID must contain only digits')

/**
 * QB display name (for Customer.DisplayName, Vendor.DisplayName lookup).
 *
 * Allows: alphanumerics, spaces, single quote/apostrophe (real names like
 * "O'Brien Trucking"), and a small set of safe punctuation.
 *
 * Rejects: backticks, semicolons (QBQL statement terminator), backslashes
 * (would defeat the escape we apply at interpolation), double quotes,
 * angle brackets, parentheses/braces/brackets, wildcards, NUL bytes, and
 * any other character that could change query semantics.
 *
 * The single-quote is allowed at the validator level but MUST be escaped
 * via `escapeQbStringLiteral()` before interpolation into a QBQL string
 * literal. QBQL escape rule: `'` → `\'` inside single-quoted strings.
 * The validator's whitelist guarantees no other escape-sensitive characters
 * survive, so the escape is safe.
 */
export const qbDisplayNameSchema = z
  .string()
  .min(1, 'Display name must not be empty')
  .max(100, 'Display name must be at most 100 characters')
  .regex(
    /^[a-zA-Z0-9 .,\-&#/+']+$/,
    'Display name contains characters not allowed in QB queries'
  )

/**
 * Escape a validated string for safe interpolation into a QBQL single-
 * quoted string literal. Only call this AFTER validateQbDisplayName() —
 * the whitelist there is what makes this escape safe.
 */
export function escapeQbStringLiteral(safeValue: string): string {
  return safeValue.replace(/'/g, "\\'")
}

/**
 * Validate a QB entity ID. Returns Zod SafeParseReturn for the caller to
 * branch on (avoids throwing in tight loops like webhook processing).
 */
export function validateQbId(id: unknown) {
  return qbIdSchema.safeParse(id)
}

/**
 * Validate a QB display name for query interpolation. Throws on invalid
 * input — call sites are user-facing API methods where throwing is the
 * correct error semantic.
 *
 * NOTE: The returned string still contains literal apostrophes if present.
 * Pass it through `escapeQbStringLiteral()` before embedding in QBQL.
 */
export function validateQbDisplayName(name: unknown): string {
  const result = qbDisplayNameSchema.safeParse(name)
  if (!result.success) {
    throw new Error(
      `Invalid QB display name: ${result.error.issues[0]?.message ?? 'unknown'}`
    )
  }
  return result.data
}
