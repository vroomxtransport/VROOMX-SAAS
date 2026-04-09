import type { Config } from '@netlify/functions'

/**
 * Netlify Scheduled Function: triggers /api/cron/alerts every 15 minutes.
 *
 * Evaluates alert rules for all tenants and sends notifications/emails
 * for any threshold breaches. Calls the existing Next.js API route
 * internally so all logic stays in one place.
 */
export default async () => {
  const siteUrl = Netlify.env.get('NEXT_PUBLIC_APP_URL') ?? Netlify.env.get('URL')
  const cronSecret = Netlify.env.get('CRON_SECRET')

  if (!siteUrl || !cronSecret) {
    console.error('[cron-alerts] Missing NEXT_PUBLIC_APP_URL or CRON_SECRET env var')
    return
  }

  const res = await fetch(`${siteUrl}/api/cron/alerts`, {
    method: 'POST',
    headers: { 'x-cron-secret': cronSecret },
  })

  const body = await res.text()
  console.log(`[cron-alerts] ${res.status}:`, body)
}

export const config: Config = {
  schedule: '*/15 * * * *', // every 15 minutes
}
