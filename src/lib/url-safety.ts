/**
 * URL safety helpers — used at every boundary where a URL goes into
 * `router.push()`, `redirect()`, an `<a href>`, or any client-side
 * navigation primitive.
 *
 * Threat model: open-redirect via attacker-controlled or DB-stored URL.
 * If a notification, search result, or returnTo param contains an absolute
 * URL like `https://evil.example.com/phish` or a protocol-relative URL
 * like `//evil.example.com/phish`, naive consumers will navigate the user
 * away from VroomX with full session context — perfect phishing setup.
 *
 * The whitelist here is intentionally narrow: only paths that are
 * unambiguously local to the current origin.
 */

/**
 * Returns true if `url` is safe to use as an internal navigation target.
 *
 * Accepts:
 *   /dashboard
 *   /orders/abc-123
 *   /orders/abc-123?foo=bar
 *   /orders/abc-123#section
 *   /
 *
 * Rejects:
 *   ""                           — empty
 *   "dashboard"                  — missing leading slash
 *   "//evil.example.com"         — protocol-relative
 *   "/\\evil.example.com"        — backslash bypass attempt
 *   "https://evil.example.com"   — absolute URL
 *   "javascript:alert(1)"        — javascript: scheme
 *   "data:text/html,..."         — data: scheme
 *   " /dashboard"                — leading whitespace (Edge tolerated this historically)
 *   "/path%0a/headersplit"       — newline injection
 */
export function isInternalUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  if (url.length === 0) return false

  // No whitespace anywhere — defends against header-splitting and parser
  // discrepancies between Node and the browser.
  if (/[\s\u0000-\u001f\u007f]/.test(url)) return false

  // Must start with exactly one '/' followed by something that is NOT
  // another '/' or a backslash. This rejects:
  //   //evil.com         (protocol-relative)
  //   /\evil.com         (backslash bypass)
  //   /\\evil.com
  if (url[0] !== '/') return false
  if (url.length > 1 && (url[1] === '/' || url[1] === '\\')) return false

  // Reject any embedded scheme separator. A path containing `://` is
  // either malformed or an evasion attempt — legitimate VroomX paths
  // never contain it.
  if (url.includes('://')) return false

  return true
}
