import { describe, it, expect } from 'vitest'
import { isTransitionAllowed } from '../work-orders'
import type { MaintenanceStatus } from '@/types'

describe('isTransitionAllowed', () => {
  it('rejects no-op transitions (same status)', () => {
    const all: MaintenanceStatus[] = ['new', 'scheduled', 'in_progress', 'completed', 'closed']
    for (const s of all) {
      expect(isTransitionAllowed(s, s)).toBe(false)
    }
  })

  it('allows the documented forward path', () => {
    expect(isTransitionAllowed('new', 'in_progress')).toBe(true)
    expect(isTransitionAllowed('in_progress', 'completed')).toBe(true)
    expect(isTransitionAllowed('completed', 'closed')).toBe(true)
  })

  it('allows reopening a closed WO back to in_progress only', () => {
    expect(isTransitionAllowed('closed', 'in_progress')).toBe(true)
    expect(isTransitionAllowed('closed', 'new')).toBe(false)
    expect(isTransitionAllowed('closed', 'scheduled')).toBe(false)
    expect(isTransitionAllowed('closed', 'completed')).toBe(false)
  })

  it('allows fast-close from new without going through in_progress', () => {
    expect(isTransitionAllowed('new', 'closed')).toBe(true)
  })

  it('disallows skipping in_progress when going completed → new', () => {
    expect(isTransitionAllowed('completed', 'new')).toBe(false)
    expect(isTransitionAllowed('completed', 'scheduled')).toBe(false)
  })

  it('matches the full allow-list table', () => {
    const cases: Array<[MaintenanceStatus, MaintenanceStatus, boolean]> = [
      ['new', 'scheduled', true],
      ['new', 'in_progress', true],
      ['new', 'closed', true],
      ['new', 'completed', false],
      ['scheduled', 'new', true],
      ['scheduled', 'in_progress', true],
      ['scheduled', 'closed', true],
      ['scheduled', 'completed', false],
      ['in_progress', 'completed', true],
      ['in_progress', 'new', true],
      ['in_progress', 'scheduled', true],
      ['in_progress', 'closed', false],
      ['completed', 'closed', true],
      ['completed', 'in_progress', true],
      ['closed', 'in_progress', true],
    ]
    for (const [from, to, expected] of cases) {
      expect(isTransitionAllowed(from, to), `${from} → ${to}`).toBe(expected)
    }
  })
})
