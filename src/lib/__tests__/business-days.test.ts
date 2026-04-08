import { describe, it, expect } from 'vitest'
import { countBusinessDays } from '../business-days'

/**
 * Helper: build a UTC Date from a YYYY-MM-DD string so tests are timezone-independent.
 */
function d(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

describe('countBusinessDays', () => {
  it('Monday → Friday = 4 business days', () => {
    // 2026-04-06 (Mon) → 2026-04-10 (Fri): Tue, Wed, Thu, Fri = 4
    expect(countBusinessDays(d('2026-04-06'), d('2026-04-10'))).toBe(4)
  })

  it('Monday → same Monday = 0 business days', () => {
    expect(countBusinessDays(d('2026-04-06'), d('2026-04-06'))).toBe(0)
  })

  it('to < from = 0 business days', () => {
    expect(countBusinessDays(d('2026-04-10'), d('2026-04-06'))).toBe(0)
  })

  it('Friday → Monday = 1 business day', () => {
    // 2026-04-10 (Fri) → 2026-04-13 (Mon): only Mon counts = 1
    expect(countBusinessDays(d('2026-04-10'), d('2026-04-13'))).toBe(1)
  })

  it('Thursday → next Wednesday = 4 business days', () => {
    // 2026-04-09 (Thu) → 2026-04-15 (Wed): Fri, Mon, Tue, Wed = 4
    expect(countBusinessDays(d('2026-04-09'), d('2026-04-15'))).toBe(4)
  })

  it('full week: Monday → next Monday = 5 business days', () => {
    // 2026-04-06 (Mon) → 2026-04-13 (Mon): Tue, Wed, Thu, Fri, Mon = 5
    expect(countBusinessDays(d('2026-04-06'), d('2026-04-13'))).toBe(5)
  })
})
