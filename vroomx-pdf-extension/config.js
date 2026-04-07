/**
 * Build-time configuration for the VroomX TMS PDF Import extension.
 *
 * M11: extracted from background.js so the project reference and other
 * deployment identifiers live in one place. Replace these values when
 * targeting a different VroomX environment (staging, dev, etc.).
 *
 * SUPABASE_PROJECT_REF is NOT a secret — it's part of the public Supabase
 * URL and the auth cookie name. Externalising it is an architectural
 * cleanup, not a security fix.
 */

'use strict';

// eslint-disable-next-line no-unused-vars
const VROOMX_CONFIG = {
  // Supabase project ref — used to construct the auth cookie name.
  // Public value, not secret. Override per-environment.
  // SEC-LEAK-03 fix: previously 'yrrczhlzulwvdqjwvhtu' (copy-paste from
  // a sibling project) which meant the extension looked for the wrong
  // sb-<ref>-auth-token cookie on the VROOMX domain and silently failed
  // to attach sessions. Correct ref is the VROOMX main app's.
  SUPABASE_PROJECT_REF: 'hqoynittztyqmurnvkxx',

  // Default VroomX base URL when chrome.storage.sync has no override.
  DEFAULT_VROOMX_URL: 'http://localhost:3000',

  // Storage / cache key names. Stable across versions.
  SESSION_TOKEN_KEY: 'vroomx_auth_token',
  SESSION_USER_KEY: 'vroomx_auth_user',
  STORAGE_IMPORT_COUNT_KEY: 'vroomx_import_count',
  PENDING_ORDERS_KEY: 'pendingOrders',
};
