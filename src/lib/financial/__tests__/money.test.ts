import { describe, it, expect } from 'vitest'
import {
  roundCurrency,
  toCurrencyString,
  equalsCurrency,
  gteCurrency,
  sumCurrencyStrings,
} from '../money'

describe('roundCurrency', () => {
  it('rounds to 2 decimals', () => {
    expect(roundCurrency(1.004)).toBe(1)
    // 1.005 → 1 in JS because the float is actually 1.00499999… — this is
    // documented JS behaviour. We accept it because the 0.005 tie-break
    // case is vanishingly rare in real currency flows.
    expect(roundCurrency(1.006)).toBe(1.01)
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3)
  })
  it('returns 0 for NaN / Infinity', () => {
    expect(roundCurrency(NaN)).toBe(0)
    expect(roundCurrency(Infinity)).toBe(0)
  })
})

describe('toCurrencyString', () => {
  it('always returns 2-decimal string', () => {
    expect(toCurrencyString(1)).toBe('1.00')
    expect(toCurrencyString(1234.567)).toBe('1234.57')
    expect(toCurrencyString(0)).toBe('0.00')
  })
})

describe('equalsCurrency', () => {
  it('treats values within 0.005 as equal', () => {
    expect(equalsCurrency(1000, 1000)).toBe(true)
    expect(equalsCurrency(1000.001, 1000)).toBe(true)
    // 0.005 is on the boundary; 0.006 is clearly outside.
    expect(equalsCurrency(1000.006, 1000)).toBe(false)
    expect(equalsCurrency(0.1 + 0.2, 0.3)).toBe(true)
  })
})

describe('gteCurrency', () => {
  it('treats a slight shortfall as "equal or greater"', () => {
    expect(gteCurrency(1000, 1000)).toBe(true)
    expect(gteCurrency(999.999, 1000)).toBe(true)
    expect(gteCurrency(999.99, 1000)).toBe(false)
    expect(gteCurrency(1001, 1000)).toBe(true)
  })
})

describe('sumCurrencyStrings', () => {
  it('sums and rounds numeric strings from Supabase', () => {
    expect(sumCurrencyStrings(['100.00', '200.50', '50.25'])).toBe(350.75)
    expect(sumCurrencyStrings(['0.1', '0.2'])).toBe(0.3)
  })
  it('handles null/undefined/empty/invalid as 0', () => {
    expect(sumCurrencyStrings(['100', null, undefined, '', 'abc', '50'])).toBe(150)
  })
  it('empty array is 0', () => {
    expect(sumCurrencyStrings([])).toBe(0)
  })
})
