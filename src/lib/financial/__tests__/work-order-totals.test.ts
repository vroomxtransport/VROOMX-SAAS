import { describe, it, expect } from 'vitest'
import { computeWorkOrderTotals } from '../work-order-totals'

describe('computeWorkOrderTotals', () => {
  it('sums labor separately from parts', () => {
    const items = [
      { kind: 'labor' as const, amount: '125.50' },
      { kind: 'labor' as const, amount: '75.00' },
      { kind: 'part' as const, amount: '42.99' },
    ]
    expect(computeWorkOrderTotals(items)).toEqual({
      totalLabor: '200.50',
      totalParts: '42.99',
      grandTotal: '243.49',
    })
  })

  it('returns zero strings for empty items', () => {
    expect(computeWorkOrderTotals([])).toEqual({
      totalLabor: '0.00',
      totalParts: '0.00',
      grandTotal: '0.00',
    })
  })

  it('fixes classic float-rounding cases at 2dp', () => {
    const items = [
      { kind: 'labor' as const, amount: '0.1' },
      { kind: 'labor' as const, amount: '0.2' },
    ]
    expect(computeWorkOrderTotals(items).totalLabor).toBe('0.30')
  })

  it('ignores items with non-numeric amounts', () => {
    const items = [
      { kind: 'labor' as const, amount: '50.00' },
      { kind: 'part' as const, amount: 'not-a-number' },
      { kind: 'part' as const, amount: '25.00' },
    ]
    expect(computeWorkOrderTotals(items)).toEqual({
      totalLabor: '50.00',
      totalParts: '25.00',
      grandTotal: '75.00',
    })
  })

  it('handles negative amounts (refunds/credits)', () => {
    const items = [
      { kind: 'part' as const, amount: '100.00' },
      { kind: 'part' as const, amount: '-10.00' },
    ]
    expect(computeWorkOrderTotals(items).totalParts).toBe('90.00')
  })
})
