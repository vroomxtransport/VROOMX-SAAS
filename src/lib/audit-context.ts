import { getClientIp } from '@/lib/client-ip'
import { headers } from 'next/headers'

export async function getAuditContext(): Promise<{
  ipAddress: string
  userAgent: string
}> {
  const [ip, h] = await Promise.all([getClientIp(), headers()])
  return {
    ipAddress: ip,
    userAgent: h.get('user-agent')?.slice(0, 500) ?? 'unknown',
  }
}
