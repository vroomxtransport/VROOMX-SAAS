'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAuditAlertConfig } from '@/hooks/use-audit-logs'
import { updateAuditAlertConfig } from '@/app/actions/audit'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Bell, Save } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Alert event definitions grouped by category
// ---------------------------------------------------------------------------

interface AlertEvent {
  entityType: string
  action: string
  label: string
  description: string
  defaultSeverity: 'info' | 'warning' | 'critical'
}

interface AlertCategory {
  label: string
  events: AlertEvent[]
}

const ALERT_CATEGORIES: AlertCategory[] = [
  {
    label: 'Access Control',
    events: [
      {
        entityType: 'custom_role',
        action: 'deleted',
        label: 'Custom Role Deleted',
        description: 'A custom role was permanently deleted',
        defaultSeverity: 'critical',
      },
      {
        entityType: 'custom_role',
        action: 'updated',
        label: 'Custom Role Updated',
        description: 'Permissions for a custom role were modified',
        defaultSeverity: 'warning',
      },
      {
        entityType: 'membership',
        action: 'removed',
        label: 'Member Removed',
        description: 'A team member was removed from the organization',
        defaultSeverity: 'warning',
      },
      {
        entityType: 'membership',
        action: 'role_changed',
        label: 'Member Role Changed',
        description: "A team member's role was changed",
        defaultSeverity: 'warning',
      },
    ],
  },
  {
    label: 'Security',
    events: [
      {
        entityType: 'auth',
        action: 'password_changed',
        label: 'Password Changed',
        description: 'An account password was changed',
        defaultSeverity: 'warning',
      },
      {
        entityType: 'auth',
        action: 'mfa_disabled',
        label: 'MFA Disabled',
        description: 'Multi-factor authentication was disabled for an account',
        defaultSeverity: 'critical',
      },
    ],
  },
  {
    label: 'Billing',
    events: [
      {
        entityType: 'tenant',
        action: 'plan_changed',
        label: 'Plan Changed',
        description: 'The subscription plan was upgraded or downgraded',
        defaultSeverity: 'info',
      },
      {
        entityType: 'billing',
        action: 'subscription_canceled',
        label: 'Subscription Canceled',
        description: 'The subscription was canceled',
        defaultSeverity: 'critical',
      },
      {
        entityType: 'tenant',
        action: 'suspended',
        label: 'Account Suspended',
        description: 'The account was suspended due to a payment issue',
        defaultSeverity: 'critical',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfigRow {
  entityType: string
  action: string
  severity: 'info' | 'warning' | 'critical'
  enabled: boolean
  notify_in_app: boolean
}

function eventKey(entityType: string, action: string): string {
  return `${entityType}:${action}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AlertConfigTab() {
  const queryClient = useQueryClient()
  const { data: savedConfigs, isLoading, isError } = useAuditAlertConfig()
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Build local state from saved configs + defaults
  const [localConfigs, setLocalConfigs] = useState<Record<string, ConfigRow> | null>(null)

  // Initialize from server data (once)
  if (!isLoading && savedConfigs !== undefined && localConfigs === null) {
    const initial: Record<string, ConfigRow> = {}

    // Set defaults from event definitions
    for (const category of ALERT_CATEGORIES) {
      for (const event of category.events) {
        const key = eventKey(event.entityType, event.action)
        initial[key] = {
          entityType: event.entityType,
          action: event.action,
          severity: event.defaultSeverity,
          enabled: false,
          notify_in_app: true,
        }
      }
    }

    // Override with saved configs
    for (const config of savedConfigs ?? []) {
      const key = eventKey(config.entity_type, config.action)
      if (key in initial) {
        initial[key] = {
          entityType: config.entity_type,
          action: config.action,
          severity: config.severity as 'info' | 'warning' | 'critical',
          enabled: config.enabled,
          notify_in_app: config.notify_in_app,
        }
      }
    }

    setLocalConfigs(initial)
  }

  function updateConfig(
    key: string,
    field: keyof ConfigRow,
    value: boolean | string
  ) {
    setLocalConfigs((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [key]: { ...prev[key], [field]: value },
      }
    })
    setSaveSuccess(false)
  }

  function handleSave() {
    if (!localConfigs) return
    setSaveError(null)
    setSaveSuccess(false)

    startTransition(async () => {
      const configs = Object.values(localConfigs).map((c) => ({
        entity_type: c.entityType,
        action: c.action,
        severity: c.severity,
        enabled: c.enabled,
        notify_in_app: c.notify_in_app,
      }))

      const result = await updateAuditAlertConfig({ configs })

      if ('error' in result) {
        setSaveError(typeof result.error === 'string' ? result.error : 'Failed to save. Please try again.')
        return
      }

      setSaveSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['audit-alert-config'] })
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface p-6 text-center">
        <p className="text-sm text-red-500">Failed to load alert configuration. Please try again.</p>
      </div>
    )
  }

  const configs = localConfigs ?? {}

  return (
    <div className="space-y-5">
      {ALERT_CATEGORIES.map((category) => (
        <div key={category.label} className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
          {/* Category header */}
          <div className="flex items-center gap-2 border-b border-border-subtle bg-muted/30 px-4 py-3">
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {category.label}
            </p>
          </div>

          {/* Event rows */}
          <div className="divide-y divide-border-subtle">
            {category.events.map((event) => {
              const key = eventKey(event.entityType, event.action)
              const config = configs[key]

              if (!config) return null

              return (
                <div
                  key={key}
                  className={cn(
                    'grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[1fr_auto_auto]',
                    'sm:items-center'
                  )}
                >
                  {/* Label + description */}
                  <div>
                    <p className="text-sm font-medium text-foreground">{event.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p>
                  </div>

                  {/* In-app toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">In-app</span>
                    <Switch
                      checked={config.notify_in_app}
                      onCheckedChange={(checked) => updateConfig(key, 'notify_in_app', checked)}
                      disabled={!config.enabled}
                    />
                  </div>

                  {/* Enabled toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Enabled</span>
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(checked) => updateConfig(key, 'enabled', checked)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Save footer */}
      <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-4 py-3">
        <div>
          {saveError && (
            <p className="text-xs text-red-500">{saveError}</p>
          )}
          {saveSuccess && (
            <p className="text-xs text-emerald-600">Alert configuration saved successfully.</p>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={isPending}
          size="sm"
          className="gap-1.5"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  )
}
