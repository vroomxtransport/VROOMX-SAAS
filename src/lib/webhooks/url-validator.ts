import { resolve4, resolve6 } from 'dns/promises'

// WH-002: Check resolved IPs against CIDR blocklist, not just URL string patterns
const BLOCKED_IP_PREFIXES = [
  '127.', '10.', '0.', '169.254.',
  '192.168.',
  // 172.16.0.0/12
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.`),
]

const BLOCKED_IPV6_PREFIXES = ['::1', 'fe80:', 'fd', 'fc', '::ffff:127.', '::ffff:10.', '::ffff:192.168.', '::ffff:169.254.']

function isPrivateIp(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (BLOCKED_IP_PREFIXES.some(prefix => ip.startsWith(prefix))) return true
  if (BLOCKED_IPV6_PREFIXES.some(prefix => lower.startsWith(prefix))) return true
  if (ip === '0.0.0.0' || lower === '::' || lower === '::1') return true
  return false
}

// Hostname-based fallback for patterns that bypass DNS (e.g. raw IPs in URL)
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^metadata\.google/i,
  /\.internal$/i,
]

export function validateWebhookUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'URL must use HTTPS' }
    }
    // WH-006: SSRF protection active in ALL environments (no NODE_ENV gate)
    if (BLOCKED_HOSTNAME_PATTERNS.some(p => p.test(parsed.hostname))) {
      return { valid: false, error: 'URL must not point to a private or internal address' }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

/** DNS-resolution-based SSRF check — call before fetch in delivery engine */
export async function validateResolvedUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname

    // Check if hostname is a raw IP
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.startsWith('[')) {
      const ip = hostname.replace(/^\[|\]$/g, '')
      if (isPrivateIp(ip)) {
        return { valid: false, error: 'URL resolves to a private address' }
      }
      return { valid: true }
    }

    // Resolve DNS and check all IPs
    const [ipv4s, ipv6s] = await Promise.allSettled([
      resolve4(hostname),
      resolve6(hostname),
    ])

    const allIps: string[] = []
    if (ipv4s.status === 'fulfilled') allIps.push(...ipv4s.value)
    if (ipv6s.status === 'fulfilled') allIps.push(...ipv6s.value)

    if (allIps.length === 0) {
      return { valid: false, error: 'URL hostname could not be resolved' }
    }

    for (const ip of allIps) {
      if (isPrivateIp(ip)) {
        return { valid: false, error: 'URL resolves to a private address' }
      }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'URL validation failed' }
  }
}
