const SENSITIVE_KEYS = new Set([
  'ssn', 'social_security', 'social_security_number',
  'date_of_birth', 'dob',
  'license_number', 'pin_hash',
  'pickup_contact_phone', 'delivery_contact_phone',
  'pickup_contact_email', 'delivery_contact_email',
  'phone', 'personal_email',
  'auth_user_id', 'secret', 'password', 'token',
])

export function sanitizePayload(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key)) continue
    if (Array.isArray(value)) {
      // WH-008: recurse into arrays of objects
      result[key] = value.map(item =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
          ? sanitizePayload(item as Record<string, unknown>)
          : item
      )
    } else if (value !== null && typeof value === 'object') {
      result[key] = sanitizePayload(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}
