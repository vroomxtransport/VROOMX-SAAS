/**
 * Centralized currency math helpers.
 *
 * JS `number` is a 64-bit float — arithmetic on currency values can
 * accumulate rounding drift (e.g. `0.1 + 0.2 === 0.30000000000000004`).
 * The project's convention is to round to 2 decimal places at every
 * boundary, but that had been spelled out ad-hoc as
 * `Math.round(x * 100) / 100` in many places, with subtly different
 * tolerances in comparison logic.
 *
 * Wave 2 of the accounting audit (W2-5) centralizes this so every
 * financial path uses the same rounding and the same epsilon for
 * "effectively equal".
 *
 * Long-term (Wave 3+) we may move to a decimal library or integer-cents,
 * but for now these helpers are enough to keep the books consistent.
 */

/** Round a money value to 2 decimal places. */
export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

/** Round and format as a string suitable for a Supabase numeric(12,2) column. */
export function toCurrencyString(value: number): string {
  return roundCurrency(value).toFixed(2)
}

/**
 * Equality tolerant to float drift (< 0.005 = less than half a cent).
 * Use for "is this payment the final one" style checks where accumulated
 * partial payments might not sum to the exact penny.
 */
export function equalsCurrency(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005
}

/**
 * `a >= b` tolerant to float drift. Semantically: "is `a` at least `b`
 * once we've rounded to the nearest cent."
 */
export function gteCurrency(a: number, b: number): boolean {
  return a >= b - 0.005
}

/**
 * Sum an array of numeric-string amounts (Supabase returns numeric cols
 * as strings) into a single rounded number. Non-finite parses count as 0.
 */
export function sumCurrencyStrings(values: (string | null | undefined)[]): number {
  let total = 0
  for (const v of values) {
    const n = parseFloat(v ?? '0')
    if (Number.isFinite(n)) total += n
  }
  return roundCurrency(total)
}
