/**
 * Lightweight circuit breaker for external API calls.
 *
 * N21: prevents cascading failures when QB/Samsara/FuelCard APIs go down.
 * Instead of every order/sync attempt waiting for a timeout and failing,
 * the circuit opens after N consecutive failures and fails-fast for a
 * cooldown period, giving the external API time to recover.
 *
 * States:
 *   CLOSED  → normal operation, requests pass through
 *   OPEN    → circuit tripped, requests fail immediately
 *   HALF    → cooldown expired, next request is a probe
 *
 * Process-local (serverless-compatible). Each Netlify function instance
 * gets its own breaker state. This is intentional — Upstash-backed
 * shared state would add latency to every external call, and
 * per-instance breakers still prevent the cascade within each instance.
 */

type CircuitState = 'closed' | 'open' | 'half-open'

interface BreakerConfig {
  /** Consecutive failures before opening the circuit. Default: 5 */
  failureThreshold?: number
  /** Milliseconds to stay open before allowing a probe. Default: 30_000 (30s) */
  cooldownMs?: number
}

interface BreakerState {
  state: CircuitState
  failures: number
  lastFailureAt: number
}

const breakers = new Map<string, BreakerState>()

const DEFAULT_THRESHOLD = 5
const DEFAULT_COOLDOWN_MS = 30_000

function getOrCreateState(name: string): BreakerState {
  let s = breakers.get(name)
  if (!s) {
    s = { state: 'closed', failures: 0, lastFailureAt: 0 }
    breakers.set(name, s)
  }
  return s
}

/**
 * Execute a function through the circuit breaker.
 *
 * @param name — breaker identity (e.g. 'quickbooks', 'samsara', 'fuelcard')
 * @param fn — the async operation to protect
 * @param config — optional thresholds
 * @returns the result of fn, or throws CircuitOpenError
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  config?: BreakerConfig,
): Promise<T> {
  const threshold = config?.failureThreshold ?? DEFAULT_THRESHOLD
  const cooldown = config?.cooldownMs ?? DEFAULT_COOLDOWN_MS
  const s = getOrCreateState(name)

  // OPEN → check if cooldown has passed
  if (s.state === 'open') {
    if (Date.now() - s.lastFailureAt >= cooldown) {
      s.state = 'half-open'
    } else {
      throw new CircuitOpenError(name, cooldown - (Date.now() - s.lastFailureAt))
    }
  }

  try {
    const result = await fn()
    // Success → reset
    s.state = 'closed'
    s.failures = 0
    return result
  } catch (error) {
    s.failures++
    s.lastFailureAt = Date.now()

    if (s.failures >= threshold) {
      s.state = 'open'
      console.error(
        `[circuit-breaker] ${name} circuit OPEN after ${s.failures} consecutive failures. ` +
        `Next probe in ${cooldown / 1000}s.`
      )
    }

    throw error
  }
}

/**
 * Check if a circuit is currently open (for logging/metrics).
 */
export function isCircuitOpen(name: string): boolean {
  const s = breakers.get(name)
  return s?.state === 'open'
}

/**
 * Error thrown when the circuit is open (fail-fast).
 */
export class CircuitOpenError extends Error {
  public readonly retryAfterMs: number

  constructor(name: string, retryAfterMs: number) {
    super(`Circuit breaker '${name}' is open. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`)
    this.name = 'CircuitOpenError'
    this.retryAfterMs = retryAfterMs
  }
}
