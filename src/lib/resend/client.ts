import { Resend } from 'resend'

const RESEND_TIMEOUT_MS = 8_000

let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

/**
 * Wraps a Resend send call with an 8-second timeout.
 *
 * The Resend SDK does not accept an AbortSignal, so we use Promise.race
 * against a rejection timer. If the timer fires first, we return a
 * structured error that callers can surface to the user verbatim.
 * safeError() in the server action handles logging.
 */
export async function sendEmailWithTimeout(
  sendFn: () => ReturnType<Resend['emails']['send']>
): Promise<{ data: Awaited<ReturnType<Resend['emails']['send']>>['data']; error: null } | { data: null; error: string }> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new DOMException('Email service timed out', 'TimeoutError')),
      RESEND_TIMEOUT_MS
    )
  )

  try {
    const result = await Promise.race([sendFn(), timeoutPromise])
    if (result.error) {
      return { data: null, error: result.error.message }
    }
    return { data: result.data, error: null }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return {
        data: null,
        error:
          'Email service timed out. The email may still be delivered — check back later.',
      }
    }
    throw err
  }
}
