import { describe, it, expect, vi } from 'vitest'
import { parseExtractedOrders } from '../pdf-parser'

// H6 unit tests — verify the JSON.parse hardening bounds in
// parseExtractedOrders. The bounds are defense in depth against a
// malicious PDF causing Claude to emit an oversized JSON payload that
// would crash the server with OOM during the per-element Zod validation.

describe('parseExtractedOrders — H6 hardening bounds', () => {
  it('returns zero orders for an empty JSON array', () => {
    const result = parseExtractedOrders('[]')
    expect(result.orders).toEqual([])
    expect(result.rawText).toBe('[]')
  })

  it('returns zero orders for non-array JSON (object)', () => {
    const result = parseExtractedOrders('{"foo": "bar"}')
    expect(result.orders).toEqual([])
  })

  it('returns zero orders for non-array JSON (number)', () => {
    const result = parseExtractedOrders('42')
    expect(result.orders).toEqual([])
  })

  it('returns zero orders for malformed JSON', () => {
    const result = parseExtractedOrders('not valid json {{{')
    expect(result.orders).toEqual([])
  })

  it('strips ```json fences before parsing', () => {
    const result = parseExtractedOrders('```json\n[]\n```')
    expect(result.orders).toEqual([])
  })

  it('drops oversized cleaned text exceeding MAX_RAW_TEXT_BYTES (100KB)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // 100KB + 1 of valid-looking JSON. The cleaned length check fires
    // BEFORE JSON.parse, so even valid syntax is rejected.
    const oversized = '[' + '"x",'.repeat(25_001) + '"x"]'
    expect(oversized.length).toBeGreaterThan(100_000)

    const result = parseExtractedOrders(oversized)
    expect(result.orders).toEqual([])
    expect(warnSpy).toHaveBeenCalledWith(
      '[pdf-parser] cleaned text exceeded MAX_RAW_TEXT_BYTES',
      expect.objectContaining({ length: expect.any(Number) })
    )

    warnSpy.mockRestore()
  })

  it('caps array length at MAX_PARSED_ORDERS (1000)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Build an array of 1500 minimal objects. Each object is invalid by
    // schema (missing required fields), so each will surface as
    // `valid: false` — but the count is what we're testing here. We must
    // assert the input fits within the 100KB raw-text bound so the cap
    // (not the size guard) is what trips.
    const items = Array.from({ length: 1500 }, () => ({}))
    const json = JSON.stringify(items)
    expect(json.length).toBeLessThan(100_000)

    const result = parseExtractedOrders(json)
    expect(result.orders).toHaveLength(1000)
    expect(warnSpy).toHaveBeenCalledWith(
      '[pdf-parser] parsed array exceeded MAX_PARSED_ORDERS',
      expect.objectContaining({ length: 1500 })
    )

    warnSpy.mockRestore()
  })

  it('does NOT cap arrays at or below MAX_PARSED_ORDERS', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const items = Array.from({ length: 1000 }, () => ({}))
    const json = JSON.stringify(items)

    const result = parseExtractedOrders(json)
    expect(result.orders).toHaveLength(1000)
    // No "exceeded" warning should fire at exactly the cap
    expect(warnSpy).not.toHaveBeenCalledWith(
      '[pdf-parser] parsed array exceeded MAX_PARSED_ORDERS',
      expect.anything()
    )

    warnSpy.mockRestore()
  })
})
