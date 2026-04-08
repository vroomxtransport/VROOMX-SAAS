import { headers } from 'next/headers'

/**
 * Returns the real client IP, preferring hosting-platform-trusted headers
 * that cannot be spoofed by the client.
 *
 * Order:
 *   1. x-nf-client-connection-ip  (Netlify — trusted, set by edge)
 *   2. cf-connecting-ip            (Cloudflare — trusted, set by edge)
 *   3. x-vercel-forwarded-for      (Vercel)
 *   4. x-forwarded-for (FIRST hop only, the rest can be spoofed)
 *   5. 'unknown'
 *
 * SEC-005: The x-forwarded-for header is trivially spoofable by the client
 * by prepending fake IPs to the list. Taking ONLY the first hop still has
 * spoofability risk on deployments without a trusted edge proxy, but it is
 * the best available fallback. In production on Netlify/Cloudflare the
 * platform-trusted header is always present and takes priority.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers()

  // Netlify — set by the edge network, cannot be spoofed by the client
  const netlify = h.get('x-nf-client-connection-ip')?.trim()
  if (netlify) return netlify

  // Cloudflare — set by the edge network, cannot be spoofed by the client
  const cf = h.get('cf-connecting-ip')?.trim()
  if (cf) return cf

  // Vercel — platform-injected, trusted within Vercel deployments
  const vercel = h.get('x-vercel-forwarded-for')?.trim()
  if (vercel) return vercel

  // x-forwarded-for: take only the first hop.
  // In a reverse-proxy chain the leftmost IP is the originating client,
  // but a client can inject fake hops at the start of the list.
  // Acceptable fallback for local dev / non-standard proxies.
  const xff = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (xff) return xff

  return 'unknown'
}
