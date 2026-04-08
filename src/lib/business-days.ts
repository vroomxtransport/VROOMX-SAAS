/**
 * Count business days (Mon-Fri) between two dates, exclusive of `from`, inclusive of `to`.
 * Matches FCRA § 1681b(b)(3) "reasonable time" convention (industry standard: 5 business days).
 *
 * Does NOT account for US federal holidays — documented limitation.
 * Timezone: uses UTC calendar days to avoid DST edge cases; for wall-clock FCRA
 * compliance the carrier is expected to act within the same business timezone.
 */
export function countBusinessDays(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0
  let count = 0
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    const day = cursor.getUTCDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}
