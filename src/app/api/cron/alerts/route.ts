// ============================================================================
// Cron Route: Alert Evaluation
// POST /api/cron/alerts
//
// Intended to be triggered by a cron scheduler (e.g. Vercel Cron, GitHub Actions)
// every 15–60 minutes. Secured by CRON_SECRET header.
//
// Flow per tenant:
//   1. Fetch all enabled alert rules
//   2. Evaluate current metric values
//   3. For each triggered rule (past cooldown):
//      a. Insert alert_history record
//      b. Update alert_rules.last_triggered_at
//      c. Create web_notification (if notify_in_app)
//      d. Send email via Resend (if notify_email)
// ============================================================================

import { NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { evaluateAlerts } from '@/lib/alerts/alert-evaluator'
import { getResend } from '@/lib/resend/client'
import { ALERT_METRICS_BY_ID, formatCondition } from '@/lib/alerts/alert-metrics'
import type { AlertRule } from '@/app/actions/alerts'

// Max tenants processed in a single invocation (guard against very large deploys)
const MAX_TENANTS = 500

export async function POST(req: Request) {
  // Authenticate the cron caller (timing-safe — CRIT-3 fix)
  if (!verifyCronSecret(req.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  // ----- 1. Fetch all unique tenant IDs that have enabled alert rules -----
  const { data: ruleRows, error: rulesErr } = await supabase
    .from('alert_rules')
    .select('tenant_id')
    .eq('enabled', true)
    .limit(MAX_TENANTS)

  if (rulesErr) {
    console.error('[cron/alerts] Failed to fetch alert rules:', rulesErr.message)
    return NextResponse.json({ error: 'Failed to load alert rules' }, { status: 500 })
  }

  const tenantIds = [...new Set((ruleRows ?? []).map((r) => r.tenant_id as string))]

  const results = {
    tenantsProcessed: 0,
    alertsTriggered: 0,
    errors: 0,
  }

  // ----- 2. Process each tenant independently -----
  for (const tenantId of tenantIds) {
    try {
      // Fetch full rule objects for this tenant
      const { data: tenantRules, error: fetchErr } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('enabled', true)

      if (fetchErr || !tenantRules?.length) continue

      const rules = tenantRules as AlertRule[]

      // Map to evaluator shape
      const evalRules = rules.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        userId: r.user_id,
        name: r.name,
        metric: r.metric,
        operator: r.operator as 'gt' | 'lt' | 'gte' | 'lte',
        threshold: r.threshold,
        notifyInApp: r.notify_in_app,
        notifyEmail: r.notify_email,
        emailRecipients: r.email_recipients,
        enabled: r.enabled,
        lastTriggeredAt: r.last_triggered_at,
        cooldownMinutes: r.cooldown_minutes,
      }))

      const triggered = await evaluateAlerts(supabase, tenantId, evalRules)

      for (const { rule, currentValue, thresholdValue } of triggered) {
        try {
          const now = new Date().toISOString()

          // a. Insert history record
          await supabase.from('alert_history').insert({
            tenant_id: tenantId,
            alert_rule_id: rule.id,
            metric_value: String(Math.round(currentValue * 100) / 100),
            threshold_value: String(thresholdValue),
            triggered_at: now,
          })

          // b. Update last_triggered_at on the rule
          await supabase
            .from('alert_rules')
            .update({ last_triggered_at: now, updated_at: now })
            .eq('id', rule.id)

          const metricDef = ALERT_METRICS_BY_ID[rule.metric]
          const conditionStr = metricDef
            ? formatCondition(metricDef, rule.operator, thresholdValue)
            : `${rule.metric} ${rule.operator} ${thresholdValue}`

          // c. In-app notification
          if (rule.notifyInApp) {
            await supabase.from('web_notifications').insert({
              tenant_id: tenantId,
              user_id: rule.userId,
              type: 'alert_triggered',
              title: `Alert: ${rule.name}`,
              body: `Threshold breached — ${conditionStr}. Current value: ${Math.round(currentValue * 100) / 100}`,
              link: '/settings/alerts',
            })
          }

          // d. Email notification
          if (rule.notifyEmail && rule.emailRecipients?.length) {
            try {
              const resend = getResend()
              const metricLabel = metricDef?.label ?? rule.metric
              await resend.emails.send({
                from: process.env.EMAIL_FROM_ALERTS ?? 'VroomX Alerts <alerts@vroomx.app>',
                to: rule.emailRecipients,
                subject: `[VroomX Alert] ${rule.name} — Threshold Breached`,
                html: buildAlertEmailHtml({
                  ruleName: rule.name,
                  metricLabel,
                  conditionStr,
                  currentValue,
                  thresholdValue,
                  unit: metricDef?.unit ?? 'number',
                }),
              })
            } catch (emailErr) {
              console.error(`[cron/alerts] Email send failed for rule ${rule.id}:`, emailErr)
            }
          }

          results.alertsTriggered++
        } catch (ruleErr) {
          console.error(`[cron/alerts] Error processing triggered rule ${rule.id}:`, ruleErr)
          results.errors++
        }
      }

      results.tenantsProcessed++
    } catch (tenantErr) {
      console.error(`[cron/alerts] Error processing tenant ${tenantId}:`, tenantErr)
      results.errors++
    }
  }

  return NextResponse.json({
    ok: true,
    ...results,
    timestamp: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Email HTML builder — plain but clean
// ---------------------------------------------------------------------------

function buildAlertEmailHtml(opts: {
  ruleName: string
  metricLabel: string
  conditionStr: string
  currentValue: number
  thresholdValue: number
  unit: string
}): string {
  const { ruleName, metricLabel, conditionStr, currentValue, thresholdValue, unit } = opts

  const formatVal = (v: number) => {
    if (unit === 'currency') return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    if (unit === 'percent') return `${Math.round(v * 100) / 100}%`
    return String(Math.round(v * 100) / 100)
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; background: #f5f5f5; margin: 0; padding: 32px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto;">
    <tr>
      <td style="background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e5e7eb;">
        <p style="font-size: 12px; font-weight: 600; color: #ef4444; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.05em;">
          Alert Triggered
        </p>
        <h1 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 8px;">${ruleName}</h1>
        <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px;">${metricLabel}</p>

        <table width="100%" cellpadding="12" cellspacing="0" style="background: #fef2f2; border-radius: 6px; border: 1px solid #fecaca; margin-bottom: 24px;">
          <tr>
            <td style="font-size: 13px; color: #374151; font-weight: 500; width: 50%;">Condition</td>
            <td style="font-size: 13px; color: #111827; font-weight: 600;">${conditionStr}</td>
          </tr>
          <tr style="border-top: 1px solid #fecaca;">
            <td style="font-size: 13px; color: #374151; font-weight: 500;">Current Value</td>
            <td style="font-size: 13px; color: #dc2626; font-weight: 700;">${formatVal(currentValue)}</td>
          </tr>
          <tr style="border-top: 1px solid #fecaca;">
            <td style="font-size: 13px; color: #374151; font-weight: 500;">Threshold</td>
            <td style="font-size: 13px; color: #111827; font-weight: 600;">${formatVal(thresholdValue)}</td>
          </tr>
        </table>

        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vroomx.app'}/settings/alerts"
           style="display: inline-block; background: #1a2b3f; color: #ffffff; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 20px; border-radius: 6px;">
          Manage Alerts
        </a>

        <p style="font-size: 11px; color: #9ca3af; margin: 24px 0 0;">
          You received this because you configured an alert in VroomX. To stop these emails, disable the alert in your settings.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
