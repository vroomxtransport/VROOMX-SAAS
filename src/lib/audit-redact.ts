/**
 * PII redaction helper for audit log metadata.
 *
 * Strip SSN / DOB / license number from any object before writing to
 * audit_logs.metadata. Pure function — no side effects, no dependencies.
 *
 * Redacts:
 *   - Keys matching /ssn|social_security|date_of_birth|dob|license_number/i
 *   - String values that look like SSNs (9-digit sequences with or without dashes)
 *   - String values that look like birth dates (YYYY-MM-DD in SSN-risk range)
 */

const PII_KEY_PATTERN = /ssn|social_security|date_of_birth|dob|license_number/i

// Matches bare 9-digit sequences (SSN without dashes)
const SSN_RAW_PATTERN = /\b\d{9}\b/g

// Matches formatted SSNs: 123-45-6789 or 123 45 6789
const SSN_FORMATTED_PATTERN = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g

// Matches ISO dates in birth-year range (1900–2015) — conservative upper bound
const BIRTH_DATE_PATTERN = /\b(19\d{2}|200\d|201[0-5])-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g

function scrubStringValue(value: string): string {
  return value
    .replace(SSN_RAW_PATTERN, '[REDACTED]')
    .replace(SSN_FORMATTED_PATTERN, '[REDACTED]')
    .replace(BIRTH_DATE_PATTERN, '[REDACTED]')
}

/**
 * Deep-walk an object and redact any PII fields.
 *
 * - Keys matching the PII pattern have their value replaced with '[REDACTED]'
 * - String values are scrubbed for SSN patterns and birth dates
 * - Arrays are mapped recursively
 * - The original object is never mutated — returns a new structure
 *
 * @param obj - Any value (object, array, primitive). Passes through non-objects unchanged.
 * @returns   - A new value with PII replaced by '[REDACTED]'
 */
export function redactPii(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(redactPii)
  }

  if (typeof obj === 'string') {
    return scrubStringValue(obj)
  }

  if (typeof obj !== 'object') {
    // number, boolean, etc. — pass through unchanged
    return obj
  }

  const result: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (PII_KEY_PATTERN.test(k)) {
      result[k] = '[REDACTED]'
    } else {
      result[k] = redactPii(v)
    }
  }

  return result
}
