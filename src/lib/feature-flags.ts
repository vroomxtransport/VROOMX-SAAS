// Typed feature flag registry — all PostHog flag keys live here.
// Add a new entry here whenever a flag is created in the PostHog dashboard.
export const FEATURE_FLAGS = {
  BATCH_IMPORT: 'enable-batch-import',
  ROUTE_OPTIMIZATION: 'enable-route-optimization',
  DRIVER_APP_V2: 'enable-driver-app-v2',
} as const

/** Union of FEATURE_FLAGS object keys, e.g. 'BATCH_IMPORT' | 'ROUTE_OPTIMIZATION' */
export type FeatureFlagKey = keyof typeof FEATURE_FLAGS

/** Union of flag string values stored in PostHog, e.g. 'enable-batch-import' */
export type FeatureFlagValue = (typeof FEATURE_FLAGS)[FeatureFlagKey]
