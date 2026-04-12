/**
 * Unit tests for the pure `formatValue` helper used by `<AnimatedNumber />`.
 *
 * We test the formatter directly because the project's Vitest config runs in
 * the node environment (no jsdom/happy-dom), so rendering the component or
 * driving `requestAnimationFrame` isn't available here. The formatter is the
 * only piece where a regression would visibly corrupt marketing-page numbers,
 * so locking it down is the highest-value test.
 */

import { describe, expect, it } from 'vitest'
import { formatValue } from '../animated-number'

describe('formatValue', () => {
  it('formats an integer with grouping', () => {
    expect(formatValue(12400, { useGrouping: true })).toBe('12,400')
  })

  it('formats a large integer with grouping', () => {
    expect(formatValue(1234567, { useGrouping: true })).toBe('1,234,567')
  })

  it('formats zero', () => {
    expect(formatValue(0, { useGrouping: true })).toBe('0')
  })

  it('formats a single-decimal value', () => {
    expect(
      formatValue(3.2, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    ).toBe('3.2')
  })

  it('rounds to max fraction digits', () => {
    // An in-flight tween can produce values like 3.187 — we want the user
    // to see a stable "3.2" snap at the end, not "3.187".
    expect(
      formatValue(3.187, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    ).toBe('3.2')
  })

  it('drops fractions when maximumFractionDigits is 0', () => {
    expect(formatValue(47, { maximumFractionDigits: 0 })).toBe('47')
    expect(formatValue(46.8, { maximumFractionDigits: 0 })).toBe('47')
  })

  it('uses default format (grouping) when none is passed', () => {
    expect(formatValue(12400)).toBe('12,400')
  })

  it('respects explicit locales', () => {
    // en-US groups with comma, de-DE groups with period
    expect(formatValue(12400, { useGrouping: true }, 'de-DE')).toBe('12.400')
  })

  it('handles negative numbers', () => {
    expect(formatValue(-1234, { useGrouping: true })).toBe('-1,234')
  })

  it('handles mid-tween fractional values without emitting decimals for integer targets', () => {
    // During a count-up from 0 → 47 the raw value is e.g. 23.4517. With
    // maximumFractionDigits: 0 the user only ever sees whole numbers.
    expect(formatValue(23.4517, { maximumFractionDigits: 0 })).toBe('23')
  })
})
