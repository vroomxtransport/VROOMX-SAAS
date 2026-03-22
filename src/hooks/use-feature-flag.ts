'use client'

// Must be called inside a component that is a descendant of <PHProvider> in providers.tsx.
// Returns false while PostHog is loading or when no flag value is set (safe default).

import { useFeatureFlagEnabled } from 'posthog-js/react'
import { FEATURE_FLAGS, type FeatureFlagKey } from '@/lib/feature-flags'

export function useFeatureFlag(flag: FeatureFlagKey): boolean {
  // useFeatureFlagEnabled returns boolean | undefined:
  //   - undefined  → PostHog not yet loaded / flag not found
  //   - true/false → resolved flag value
  // Coerce undefined → false so callers always get a boolean.
  return useFeatureFlagEnabled(FEATURE_FLAGS[flag]) ?? false
}
