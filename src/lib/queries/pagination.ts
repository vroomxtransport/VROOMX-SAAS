/**
 * Pagination helpers for tenant-scoped list queries.
 *
 * AUTH-003: every list query in this directory previously accepted a
 * caller-supplied `pageSize` with a default of 20 and no upper bound.
 * A caller passing `pageSize: 10000` would get 10000 rows back —
 * bounded by RLS to the caller's tenant, so not a data leak, but:
 *
 *   1. Cost DoS — one query fetching 100k rows burns serverless CPU/
 *      memory and Supabase egress credits.
 *   2. Timing channel — response-time variance with large page sizes
 *      leaks tenant dataset shape even under tenant isolation.
 *   3. UI misuse — a runaway dev mistake in a client component that
 *      forgets to set pageSize will silently fetch everything.
 *
 * Clamp to a reasonable upper bound and document the contract in one
 * place so every query file uses the same ceiling.
 */

/** Hard upper bound on any single list query. */
export const MAX_PAGE_SIZE = 500

/** Default page size when the caller doesn't specify. */
export const DEFAULT_PAGE_SIZE = 20

/**
 * Clamp a caller-supplied pageSize to `[1, MAX_PAGE_SIZE]`, falling
 * back to `DEFAULT_PAGE_SIZE` when the input is undefined or not a
 * positive integer. NaN, negative, zero, and oversized inputs are
 * all silently normalized rather than thrown so an API caller can't
 * DoS themselves with a bad URL param.
 */
export function clampPageSize(pageSize: number | undefined): number {
  if (pageSize === undefined || !Number.isFinite(pageSize) || pageSize <= 0) {
    return DEFAULT_PAGE_SIZE
  }
  return Math.min(Math.floor(pageSize), MAX_PAGE_SIZE)
}
