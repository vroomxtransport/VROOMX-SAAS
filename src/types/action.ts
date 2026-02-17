// ============================================================================
// Unified Server Action Response Types
// ============================================================================

/**
 * Success response with data.
 * Used by create, update, and status-change actions.
 */
export type ActionSuccessWithData<T> = { success: true; data: T }

/**
 * Success response without data.
 * Used by delete actions and void operations.
 */
export type ActionSuccessVoid = { success: true }

/**
 * Zod field-level validation errors.
 * Shape: { fieldName: ['message1', 'message2'] }
 */
export type ActionFieldErrors = { error: Record<string, string[]> }

/**
 * Generic string error (auth, runtime, business logic).
 */
export type ActionError = { error: string }

/**
 * Unified action result.
 * - ActionResult<T> → success returns { success: true, data: T }
 * - ActionResult    → success returns { success: true }
 */
export type ActionResult<T = void> =
  | (T extends void ? ActionSuccessVoid : ActionSuccessWithData<T>)
  | ActionFieldErrors
  | ActionError

// ============================================================================
// Type Guards
// ============================================================================

/** Check if result is any kind of error (string or field errors). */
export function isActionError(
  result: ActionResult<unknown>
): result is ActionError | ActionFieldErrors {
  return 'error' in result
}

/** Check if result is a field-level validation error. */
export function isFieldError(
  result: ActionResult<unknown>
): result is ActionFieldErrors {
  return 'error' in result && typeof result.error === 'object' && result.error !== null
}

/** Check if result is a string error (auth/runtime). */
export function isStringError(
  result: ActionResult<unknown>
): result is ActionError {
  return 'error' in result && typeof result.error === 'string'
}
