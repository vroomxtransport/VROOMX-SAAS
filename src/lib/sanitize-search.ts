/**
 * Sanitize a search string for use in PostgREST .or() / .ilike() filters.
 * Strips characters that have special meaning in PostgREST filter syntax.
 */
export function sanitizeSearch(input: string): string {
  return input
    .replace(/[(),.\\'%]/g, '')
    .trim()
    .slice(0, 200)
}
