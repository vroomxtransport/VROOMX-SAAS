import type { Config } from '@netlify/functions'

/**
 * Netlify Scheduled Function: triggers /api/cron/reports every hour.
 *
 * Processes due scheduled reports for all tenants — generates CSV data
 * and emails it to configured recipients. Calls the existing Next.js
 * API route internally so all logic stays in one place.
 */
export default async () => {
  const siteUrl = Netlify.env.get('NEXT_PUBLIC_APP_URL') ?? Netlify.env.get('URL')
  const cronSecret = Netlify.env.get('CRON_SECRET')

  if (!siteUrl || !cronSecret) {
    console.error('[cron-reports] Missing NEXT_PUBLIC_APP_URL or CRON_SECRET env var')
    return
  }

  const res = await fetch(`${siteUrl}/api/cron/reports`, {
    method: 'POST',
    headers: { 'x-cron-secret': cronSecret },
  })

  const body = await res.text()
  console.log(`[cron-reports] ${res.status}:`, body)
}

export const config: Config = {
  schedule: '@hourly', // every hour at :00
}
