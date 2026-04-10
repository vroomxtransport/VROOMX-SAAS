/**
 * Order-level distance and per-mile metric utilities.
 * Mirrors the trip-level RPM/CPM pattern in trip-financial-card.tsx.
 */

export function parseDistanceMiles(val: string | null | undefined): number | null {
  if (!val) return null
  const n = parseFloat(val)
  return isNaN(n) || n <= 0 ? null : n
}

export function computeRevenuePerMile(
  revenue: string | number,
  distanceMiles: string | null | undefined
): number | null {
  const miles = parseDistanceMiles(distanceMiles)
  if (!miles) return null
  const rev = typeof revenue === 'string' ? parseFloat(revenue) : revenue
  if (isNaN(rev)) return null
  return Math.round((rev / miles) * 100) / 100
}

/**
 * Compute Driver Pay / Mile for an order.
 *
 * Note: the underlying DB column is still named `carrier_pay` but now
 * holds the computed driver-pay value (see
 * `src/lib/financial/driver-pay.ts`). This function name reflects the
 * new semantic; callers should pass `order.carrier_pay` as `driverPay`.
 */
export function computeDriverPayPerMile(
  driverPay: string | number,
  distanceMiles: string | null | undefined
): number | null {
  const miles = parseDistanceMiles(distanceMiles)
  if (!miles) return null
  const dp = typeof driverPay === 'string' ? parseFloat(driverPay) : driverPay
  if (isNaN(dp)) return null
  return Math.round((dp / miles) * 100) / 100
}

export function formatMiles(miles: number | null): string {
  if (miles === null) return '--'
  return `${miles.toLocaleString()} mi`
}

export function formatPerMile(value: number | null): string {
  if (value === null) return '--'
  return `$${value.toFixed(2)}/mi`
}
