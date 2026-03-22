// Server-side PostHog client (posthog-node).
// Use this in Server Components, Server Actions, and API routes.
// Never import from posthog-js here — that is browser-only.

import { PostHog } from 'posthog-node'
import { FEATURE_FLAGS, type FeatureFlagKey } from '@/lib/feature-flags'

// Module-level singleton — safe in Node.js / serverless because each worker
// process gets its own module cache. flushAt:1 + flushInterval:0 ensures
// every evaluate call is flushed immediately (important for serverless where
// the process may not live long enough for a batched flush).
let _client: PostHog | null = null

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return null

  if (!_client) {
    _client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return _client
}

/**
 * Evaluate a typed feature flag server-side.
 *
 * @param flag       - Key from FEATURE_FLAGS (e.g. 'BATCH_IMPORT')
 * @param distinctId - PostHog distinct_id for the user (use Supabase user.id)
 * @returns          - true if the flag is enabled for this user, false otherwise
 *
 * @example
 * const enabled = await isFeatureFlagEnabled('BATCH_IMPORT', user.id)
 */
export async function isFeatureFlagEnabled(
  flag: FeatureFlagKey,
  distinctId: string,
): Promise<boolean> {
  const client = getClient()
  if (!client) return false

  const result = await client.isFeatureEnabled(FEATURE_FLAGS[flag], distinctId)
  return result ?? false
}

/**
 * Low-level helper for evaluating an arbitrary flag string server-side.
 * Prefer `isFeatureFlagEnabled` with a typed key when possible.
 */
export async function isRawFeatureEnabled(
  flagKey: string,
  distinctId: string,
): Promise<boolean> {
  const client = getClient()
  if (!client) return false

  const result = await client.isFeatureEnabled(flagKey, distinctId)
  return result ?? false
}
