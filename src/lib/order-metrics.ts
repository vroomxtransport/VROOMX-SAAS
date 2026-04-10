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

export function computeCarrierPayPerMile(
  carrierPay: string | number,
  distanceMiles: string | null | undefined
): number | null {
  const miles = parseDistanceMiles(distanceMiles)
  if (!miles) return null
  const cp = typeof carrierPay === 'string' ? parseFloat(carrierPay) : carrierPay
  if (isNaN(cp)) return null
  return Math.round((cp / miles) * 100) / 100
}

export function formatMiles(miles: number | null): string {
  if (miles === null) return '--'
  return `${miles.toLocaleString()} mi`
}

export function formatPerMile(value: number | null): string {
  if (value === null) return '--'
  return `$${value.toFixed(2)}/mi`
}
