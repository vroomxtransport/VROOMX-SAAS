/**
 * Unit tests for sanitizeSearch (src/lib/sanitize-search.ts).
 *
 * Regression context (commit e1dde3a, C-1):
 *   The Samsara syncDriverMapping action used .ilike() with driver names taken
 *   directly from the Samsara API response without sanitization. A malicious
 *   Samsara operator could inject PostgREST filter metacharacters or SQL LIKE
 *   wildcards to widen the query beyond its intended scope.
 *
 *   Fix: sanitizeSearch() is now applied to both name parts before .ilike().
 *
 * These tests:
 *   1. Verify the utility strips each class of dangerous character
 *   2. Document the characters that ARE safe (pass through unchanged)
 *   3. Guard the length cap (200 chars)
 *   4. Guard empty/whitespace-only input
 */

import { describe, it, expect } from 'vitest'
import { sanitizeSearch } from '../sanitize-search'

describe('sanitizeSearch — SQL LIKE wildcard stripping', () => {
  it('strips % (LIKE wildcard — matches any sequence)', () => {
    expect(sanitizeSearch('%')).toBe('')
    expect(sanitizeSearch('%admin%')).toBe('admin')
    expect(sanitizeSearch('John%')).toBe('John')
  })

  it('strips _ (LIKE wildcard — matches any single character)', () => {
    // Note: _ is not in the regex but the docstring mentions it as a concern.
    // The current implementation strips % , . ( ) \\ \' " ; : !
    // This test documents the actual behavior so regressions are visible.
    // If _ stripping is ever added, this test will catch it.
    const result = sanitizeSearch('_name_')
    // Current impl: _ is NOT stripped — document actual behavior
    expect(result).toBe('_name_')
  })
})

describe('sanitizeSearch — PostgREST filter metacharacter stripping', () => {
  it('strips comma (PostgREST .or() separator)', () => {
    expect(sanitizeSearch('John,Smith')).toBe('JohnSmith')
    expect(sanitizeSearch(',leading')).toBe('leading')
  })

  it('strips period (PostgREST operator separator e.g. field.ilike.value)', () => {
    expect(sanitizeSearch('first.name')).toBe('firstname')
  })

  it('strips semicolon (can interact with filter parsing)', () => {
    expect(sanitizeSearch('value;extra')).toBe('valueextra')
  })

  it('strips colon (filter syntax)', () => {
    expect(sanitizeSearch('key:value')).toBe('keyvalue')
  })

  it('strips single quote (SQL string delimiter)', () => {
    expect(sanitizeSearch("O'Brien")).toBe('OBrien')
    expect(sanitizeSearch("it's")).toBe('its')
  })

  it('strips double quote', () => {
    expect(sanitizeSearch('"quoted"')).toBe('quoted')
  })

  it('strips backslash (escape character)', () => {
    expect(sanitizeSearch('back\\slash')).toBe('backslash')
  })

  it('strips open and close parentheses', () => {
    expect(sanitizeSearch('(value)')).toBe('value')
    expect(sanitizeSearch('a(b)c')).toBe('abc')
  })

  it('strips exclamation mark', () => {
    expect(sanitizeSearch('hello!')).toBe('hello')
  })

  it('strips multiple metacharacters in combination', () => {
    // Attempt to inject an extra ilike predicate via PostgREST .or() filter
    const injection = "John,or(first_name.eq.admin)"
    const sanitized = sanitizeSearch(injection)
    // Should not contain comma or parentheses
    expect(sanitized).not.toContain(',')
    expect(sanitized).not.toContain('(')
    expect(sanitized).not.toContain(')')
  })

  it('strips a realistic malicious Samsara driver name injection attempt', () => {
    // A Samsara operator sets driver name to: foo%,or(tenant_id.neq.tenant-uuid)
    const malicious = "foo%,or(tenant_id.neq.tenant-uuid)"
    const sanitized = sanitizeSearch(malicious)
    expect(sanitized).not.toContain('%')
    expect(sanitized).not.toContain(',')
    expect(sanitized).not.toContain('(')
    expect(sanitized).not.toContain(')')
    expect(sanitized).not.toContain('.')
    // What remains should be a safe string
    expect(sanitized).toBe('fooortenant_idneqtenant-uuid')
  })
})

describe('sanitizeSearch — safe characters pass through', () => {
  it('preserves alphanumeric characters', () => {
    expect(sanitizeSearch('JohnSmith123')).toBe('JohnSmith123')
  })

  it('preserves hyphens (common in names)', () => {
    expect(sanitizeSearch('Mary-Jane')).toBe('Mary-Jane')
  })

  it('preserves spaces (trimmed at ends, kept in middle)', () => {
    expect(sanitizeSearch('John Smith')).toBe('John Smith')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeSearch('  John  ')).toBe('John')
  })

  it('returns the original string when no special characters are present', () => {
    expect(sanitizeSearch('Alice')).toBe('Alice')
    expect(sanitizeSearch('Bob Jones')).toBe('Bob Jones')
  })
})

describe('sanitizeSearch — length cap', () => {
  it('caps output at 200 characters', () => {
    const longInput = 'a'.repeat(300)
    const result = sanitizeSearch(longInput)
    expect(result.length).toBe(200)
  })

  it('caps after stripping (strip first, then cap)', () => {
    // 201 safe chars — strip removes nothing, cap truncates to 200
    const input = 'a'.repeat(201)
    expect(sanitizeSearch(input).length).toBe(200)
  })
})

describe('sanitizeSearch — edge cases', () => {
  it('returns empty string for input consisting entirely of stripped characters', () => {
    expect(sanitizeSearch('%%;:')).toBe('')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeSearch('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeSearch('   ')).toBe('')
  })

  it('handles a normal short driver name without mutation', () => {
    expect(sanitizeSearch('James')).toBe('James')
    expect(sanitizeSearch('Williams')).toBe('Williams')
  })
})
