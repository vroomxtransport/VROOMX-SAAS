/**
 * Sanitize a search string for use in PostgREST .or() / .ilike() filters.
 * Strips characters that have special meaning in PostgREST filter syntax.
 *
 * The comma is the .or() filter separator; the period is the operator
 * separator (e.g. `field.ilike.value`); semicolons, colons, and quotes
 * can interact with filter parsing in edge cases. Stripping all of them
 * prevents filter-injection attacks where a user-supplied search term
 * introduces additional PostgREST predicates.
 */
export function sanitizeSearch(input: string): string {
  return input
    .replace(/[(),.\\'"%;:!]/g, '')
    .trim()
    .slice(0, 200)
}
