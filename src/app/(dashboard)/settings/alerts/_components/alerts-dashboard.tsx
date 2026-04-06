'use client'

import { useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  fetchAlertRules,
  fetchAlertHistory,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  toggleAlertRule,
  type AlertRule,
  type AlertHistoryRow,
} from '@/app/actions/alerts'
import {
  ALERT_METRICS,
  ALERT_METRICS_BY_ID,
  ALERT_METRICS_BY_CATEGORY,
  CATEGORY_LABELS,
  OPERATOR_LABELS,
  OPERATOR_SYMBOLS,
  formatThreshold,
  formatCondition,
  type AlertMetricDef,
  type AlertOperator,
} from '@/lib/alerts/alert-metrics'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { BellRing, Plus, Pencil, Trash2, Clock, TriangleAlert, History } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useAlertRules() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['alert-rules'],
    queryFn: () => fetchAlertRules(supabase),
    staleTime: 30_000,
  })
}

function useAlertHistory() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['alert-history'],
    queryFn: () => fetchAlertHistory(supabase, 30),
    staleTime: 30_000,
  })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertFormMode = 'create' | 'edit'

interface AlertFormState {
  name: string
  metric: string
  operator: AlertOperator
  threshold: string
  notifyInApp: boolean
  notifyEmail: boolean
  emailRecipients: string
  cooldownMinutes: string
}

const DEFAULT_FORM: AlertFormState = {
  name: '',
  metric: 'daily_revenue',
  operator: 'lt',
  threshold: '5000',
  notifyInApp: true,
  notifyEmail: false,
  emailRecipients: '',
  cooldownMinutes: '1440',
}

function ruleToForm(rule: AlertRule): AlertFormState {
  return {
    name: rule.name,
    metric: rule.metric,
    operator: rule.operator,
    threshold: rule.threshold,
    notifyInApp: rule.notify_in_app,
    notifyEmail: rule.notify_email,
    emailRecipients: (rule.email_recipients ?? []).join(', '),
    cooldownMinutes: String(rule.cooldown_minutes),
  }
}

// ---------------------------------------------------------------------------
// Status indicator helpers
// ---------------------------------------------------------------------------

function getStatusConfig(rule: AlertRule): {
  label: string
  dotClass: string
  badgeVariant: 'default' | 'secondary' | 'destructive'
} {
  if (!rule.enabled) {
    return { label: 'Disabled', dotClass: 'bg-muted-foreground', badgeVariant: 'secondary' }
  }
  if (rule.last_triggered_at) {
    const msSince = Date.now() - new Date(rule.last_triggered_at).getTime()
    const hoursSince = msSince / 1000 / 3600
    if (hoursSince < 24) {
      return { label: 'Triggered', dotClass: 'bg-destructive animate-pulse', badgeVariant: 'destructive' }
    }
  }
  return { label: 'Active', dotClass: 'bg-emerald-500', badgeVariant: 'default' }
}

// ---------------------------------------------------------------------------
// Alert Form Dialog
// ---------------------------------------------------------------------------

interface AlertFormDialogProps {
  open: boolean
  onClose: () => void
  mode: AlertFormMode
  editingRule?: AlertRule
}

function AlertFormDialog({ open, onClose, mode, editingRule }: AlertFormDialogProps) {
  const qc = useQueryClient()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<AlertFormState>(
    mode === 'edit' && editingRule ? ruleToForm(editingRule) : DEFAULT_FORM
  )
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const selectedMetricDef = ALERT_METRICS_BY_ID[form.metric] as AlertMetricDef | undefined
  const unit = selectedMetricDef?.unit ?? 'number'

  const handleMetricChange = (metricId: string) => {
    const def = ALERT_METRICS_BY_ID[metricId]
    if (def) {
      setForm((prev) => ({
        ...prev,
        metric: metricId,
        operator: def.defaultOperator,
        threshold: String(def.defaultThreshold),
        name: prev.name || def.label,
      }))
    }
  }

  const getUnitPrefix = () => unit === 'currency' ? '$' : ''
  const getUnitSuffix = () => {
    if (unit === 'percent') return '%'
    if (unit === 'days') return 'd'
    return ''
  }

  const handleSubmit = () => {
    startTransition(async () => {
      const emailRecipients = form.emailRecipients
        ? form.emailRecipients.split(',').map((e) => e.trim()).filter(Boolean)
        : []

      const payload = {
        name: form.name,
        metric: form.metric,
        operator: form.operator,
        threshold: parseFloat(form.threshold),
        notifyInApp: form.notifyInApp,
        notifyEmail: form.notifyEmail,
        emailRecipients: emailRecipients.length ? emailRecipients : null,
        cooldownMinutes: parseInt(form.cooldownMinutes, 10),
        ...(mode === 'edit' && editingRule ? { id: editingRule.id } : {}),
      }

      const result = mode === 'edit'
        ? await updateAlertRule(payload)
        : await createAlertRule(payload)

      if ('error' in result && result.error) {
        if (typeof result.error === 'object') {
          setErrors(result.error as Record<string, string[]>)
        }
        return
      }

      qc.invalidateQueries({ queryKey: ['alert-rules'] })
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Alert Rule' : 'Add Alert Rule'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="alert-name">Alert Name</Label>
            <Input
              id="alert-name"
              placeholder="e.g. Daily Revenue Below Target"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}
          </div>

          {/* Metric */}
          <div className="space-y-1.5">
            <Label>Metric</Label>
            <Select value={form.metric} onValueChange={handleMetricChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select metric..." />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ALERT_METRICS_BY_CATEGORY) as [AlertMetricDef['category'], AlertMetricDef[]][]).map(
                  ([category, metrics]) =>
                    metrics.length > 0 && (
                      <SelectGroup key={category}>
                        <SelectLabel>{CATEGORY_LABELS[category]}</SelectLabel>
                        {metrics.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )
                )}
              </SelectContent>
            </Select>
            {selectedMetricDef && (
              <p className="text-xs text-muted-foreground">{selectedMetricDef.description}</p>
            )}
          </div>

          {/* Operator + Threshold */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select
                value={form.operator}
                onValueChange={(v) => setForm({ ...form, operator: v as AlertOperator })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['gt', 'lt', 'gte', 'lte'] as AlertOperator[]).map((op) => (
                    <SelectItem key={op} value={op}>
                      {OPERATOR_SYMBOLS[op]} {OPERATOR_LABELS[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Threshold</Label>
              <div className="relative flex items-center">
                {getUnitPrefix() && (
                  <span className="absolute left-3 text-sm text-muted-foreground pointer-events-none">
                    {getUnitPrefix()}
                  </span>
                )}
                <Input
                  className={getUnitPrefix() ? 'pl-6' : getUnitSuffix() ? 'pr-6' : ''}
                  type="number"
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                />
                {getUnitSuffix() && (
                  <span className="absolute right-3 text-sm text-muted-foreground pointer-events-none">
                    {getUnitSuffix()}
                  </span>
                )}
              </div>
              {errors.threshold && <p className="text-xs text-destructive">{errors.threshold[0]}</p>}
            </div>
          </div>

          {/* Preview */}
          {selectedMetricDef && form.threshold && (
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Trigger when:{' '}
              <span className="font-semibold text-foreground">
                {formatCondition(
                  selectedMetricDef,
                  form.operator,
                  parseFloat(form.threshold) || 0
                )}
              </span>
            </div>
          )}

          {/* Notification channels */}
          <div className="space-y-2">
            <Label>Notifications</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={form.notifyInApp}
                  onCheckedChange={(v) => setForm({ ...form, notifyInApp: !!v })}
                />
                <span className="text-sm">In-app notification</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={form.notifyEmail}
                  onCheckedChange={(v) => setForm({ ...form, notifyEmail: !!v })}
                />
                <span className="text-sm">Email</span>
              </label>
            </div>
          </div>

          {/* Email recipients */}
          {form.notifyEmail && (
            <div className="space-y-1.5">
              <Label htmlFor="email-recipients">Email Recipients</Label>
              <Input
                id="email-recipients"
                placeholder="alice@co.com, bob@co.com"
                value={form.emailRecipients}
                onChange={(e) => setForm({ ...form, emailRecipients: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Comma-separated email addresses</p>
              {errors.emailRecipients && (
                <p className="text-xs text-destructive">{errors.emailRecipients[0]}</p>
              )}
            </div>
          )}

          {/* Cooldown */}
          <div className="space-y-1.5">
            <Label htmlFor="cooldown">Cooldown (minutes)</Label>
            <Select
              value={form.cooldownMinutes}
              onValueChange={(v) => setForm({ ...form, cooldownMinutes: v })}
            >
              <SelectTrigger id="cooldown">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="360">6 hours</SelectItem>
                <SelectItem value="720">12 hours</SelectItem>
                <SelectItem value="1440">24 hours (default)</SelectItem>
                <SelectItem value="4320">3 days</SelectItem>
                <SelectItem value="10080">1 week</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Minimum time between repeated alerts for the same rule
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name || !form.metric}>
            {isPending ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Alert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Alert Rule Card
// ---------------------------------------------------------------------------

interface AlertRuleCardProps {
  rule: AlertRule
  onEdit: (rule: AlertRule) => void
}

function AlertRuleCard({ rule, onEdit }: AlertRuleCardProps) {
  const qc = useQueryClient()
  const [, startTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)
  const metricDef = ALERT_METRICS_BY_ID[rule.metric] as AlertMetricDef | undefined
  const { label: statusLabel, dotClass } = getStatusConfig(rule)

  const handleToggle = (enabled: boolean) => {
    startTransition(async () => {
      await toggleAlertRule({ id: rule.id, enabled })
      qc.invalidateQueries({ queryKey: ['alert-rules'] })
    })
  }

  const handleDelete = async () => {
    setDeleting(true)
    await deleteAlertRule({ id: rule.id })
    qc.invalidateQueries({ queryKey: ['alert-rules'] })
    setDeleting(false)
  }

  const conditionStr = metricDef
    ? formatCondition(metricDef, rule.operator, parseFloat(rule.threshold))
    : `${rule.metric} ${rule.operator} ${rule.threshold}`

  return (
    <div className="widget-card group flex items-start gap-4 p-4">
      {/* Status dot */}
      <div className="mt-1 flex-shrink-0">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`} aria-label={statusLabel} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{rule.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {metricDef?.label ?? rule.metric}
              <span className="mx-1.5 text-border-subtle">·</span>
              <span className="text-foreground/80 font-medium">{conditionStr}</span>
            </p>
          </div>
          {/* Category badge */}
          {metricDef && (
            <Badge variant="secondary" className="text-xs shrink-0 capitalize">
              {CATEGORY_LABELS[metricDef.category]}
            </Badge>
          )}
        </div>

        {/* Meta row */}
        <div className="mt-2 flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {rule.cooldown_minutes >= 1440
              ? `${rule.cooldown_minutes / 1440}d cooldown`
              : rule.cooldown_minutes >= 60
                ? `${rule.cooldown_minutes / 60}h cooldown`
                : `${rule.cooldown_minutes}m cooldown`}
          </span>

          {rule.last_triggered_at && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <TriangleAlert className="h-3 w-3 text-amber-500" />
              Triggered {formatDistanceToNow(new Date(rule.last_triggered_at), { addSuffix: true })}
            </span>
          )}

          {/* Channels */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {rule.notify_in_app && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-medium">In-app</span>
            )}
            {rule.notify_email && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-medium">Email</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          size="sm"
          checked={rule.enabled}
          onCheckedChange={handleToggle}
          aria-label={`${rule.enabled ? 'Disable' : 'Enable'} alert`}
        />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onEdit(rule)}
          aria-label="Edit alert"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
              aria-label="Delete alert"
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Alert Rule</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{rule.name}&quot; and all its trigger history.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// History row
// ---------------------------------------------------------------------------

type HistoryRow = AlertHistoryRow & { alert_rules: { name: string; metric: string } | null }

function HistoryEntry({ entry }: { entry: HistoryRow }) {
  const metricDef = entry.alert_rules?.metric
    ? (ALERT_METRICS_BY_ID[entry.alert_rules.metric] as AlertMetricDef | undefined)
    : undefined

  const metricValue = parseFloat(entry.metric_value)
  const thresholdValue = parseFloat(entry.threshold_value)

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {entry.alert_rules?.name ?? 'Deleted rule'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {metricDef ? formatThreshold(metricValue, metricDef.unit) : String(metricValue)}
          <span className="mx-1 text-border-subtle">vs threshold</span>
          {metricDef ? formatThreshold(thresholdValue, metricDef.unit) : String(thresholdValue)}
        </p>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {formatDistanceToNow(new Date(entry.triggered_at), { addSuffix: true })}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AlertsDashboard() {
  const { data: rules, isLoading: rulesLoading } = useAlertRules()
  const { data: history, isLoading: historyLoading } = useAlertHistory()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | undefined>()
  const [dialogMode, setDialogMode] = useState<AlertFormMode>('create')

  const handleAddClick = () => {
    setEditingRule(undefined)
    setDialogMode('create')
    setDialogOpen(true)
  }

  const handleEditClick = (rule: AlertRule) => {
    setEditingRule(rule)
    setDialogMode('edit')
    setDialogOpen(true)
  }

  const handleClose = () => {
    setDialogOpen(false)
    setEditingRule(undefined)
  }

  const enabledCount = (rules ?? []).filter((r) => r.enabled).length
  const totalCount = (rules ?? []).length

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="widget-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <BellRing className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">KPI Threshold Alerts</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Get notified when key metrics cross your targets
              </p>
            </div>
          </div>
          <Button size="sm" onClick={handleAddClick} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Alert
          </Button>
        </div>

        {totalCount > 0 && (
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground border-t border-border pt-4">
            <span>
              <span className="font-semibold text-foreground">{enabledCount}</span> active
            </span>
            <span>
              <span className="font-semibold text-foreground">{totalCount - enabledCount}</span> disabled
            </span>
            <span>
              <span className="font-semibold text-foreground">{totalCount}</span> total
            </span>
          </div>
        )}
      </div>

      {/* Rules list */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
          Alert Rules
        </h3>

        {rulesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : !rules?.length ? (
          <div className="widget-card flex flex-col items-center justify-center py-14 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <BellRing className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No alerts configured</p>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              Set thresholds on revenue, cost, or performance metrics and get notified the moment something drifts.
            </p>
            <Button size="sm" onClick={handleAddClick}>
              <Plus className="mr-1.5 h-4 w-4" />
              Create your first alert
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <AlertRuleCard key={rule.id} rule={rule} onEdit={handleEditClick} />
            ))}
          </div>
        )}
      </div>

      {/* Alert History */}
      <div>
        <div className="flex items-center gap-2 mb-2 px-0.5">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Triggers
          </h3>
        </div>

        <div className="widget-card p-0 divide-y divide-border">
          {historyLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !history?.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <p className="text-sm text-muted-foreground">No alerts have triggered yet</p>
            </div>
          ) : (
            <div className="px-4">
              {history.map((entry) => (
                <HistoryEntry key={entry.id} entry={entry as HistoryRow} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form dialog */}
      <AlertFormDialog
        open={dialogOpen}
        onClose={handleClose}
        mode={dialogMode}
        editingRule={editingRule}
      />
    </div>
  )
}
