'use client'

import { useState, useTransition, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  createWebhookEndpoint,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  toggleWebhookEndpoint,
  rotateWebhookSecret,
  retryWebhookDelivery,
} from '@/app/actions/webhooks'
import {
  WEBHOOK_EVENT_GROUPS,
} from '@/lib/webhooks/webhook-types'
import type { WebhookEventType } from '@/lib/webhooks/webhook-types'
import type { WebhookEndpoint, WebhookDelivery } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  Webhook,
  Plus,
  Pencil,
  Trash2,
  Copy,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  RotateCw,
} from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Relative time formatter (no external library)
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// ---------------------------------------------------------------------------
// Types for client-side use (secret excluded from select)
// ---------------------------------------------------------------------------

type EndpointRow = Omit<WebhookEndpoint, 'secret' | 'tenant_id'>

type DeliveryRow = Pick<
  WebhookDelivery,
  'id' | 'endpoint_id' | 'event_type' | 'status' | 'response_code' | 'attempts' | 'max_attempts' | 'created_at'
>

// ---------------------------------------------------------------------------
// Hooks (inline, matching alerts pattern)
// ---------------------------------------------------------------------------

function useWebhookEndpoints() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_endpoints')
        .select('id, url, events, description, enabled, created_at, updated_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as EndpointRow[]
    },
    staleTime: 30_000,
  })
}

function useWebhookDeliveries(endpointId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['webhook-deliveries', endpointId],
    queryFn: async () => {
      let query = supabase
        .from('webhook_deliveries')
        .select('id, endpoint_id, event_type, status, response_code, attempts, max_attempts, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (endpointId) {
        query = query.eq('endpoint_id', endpointId)
      }
      const { data, error } = await query
      if (error) throw error
      return data as DeliveryRow[]
    },
    enabled: !!endpointId,
    staleTime: 30_000,
  })
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface EndpointFormState {
  url: string
  description: string
  events: WebhookEventType[]
}

const DEFAULT_FORM: EndpointFormState = {
  url: '',
  description: '',
  events: [],
}

function endpointToForm(ep: EndpointRow): EndpointFormState {
  return {
    url: ep.url,
    description: ep.description ?? '',
    events: ep.events as WebhookEventType[],
  }
}

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

function statusBadgeClasses(status: WebhookDelivery['status']): string {
  switch (status) {
    case 'success':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    case 'pending':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    case 'failed':
    case 'exhausted':
      return 'bg-red-500/10 text-red-500 border-red-500/20'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function statusIcon(status: WebhookDelivery['status']) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-3 w-3" />
    case 'pending':
      return <Clock className="h-3 w-3" />
    case 'failed':
    case 'exhausted':
      return <XCircle className="h-3 w-3" />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Endpoint Form Dialog
// ---------------------------------------------------------------------------

interface EndpointFormDialogProps {
  open: boolean
  onClose: () => void
  editingEndpoint: EndpointRow | null
  onSecretRevealed: (secret: string) => void
}

function EndpointFormDialog({ open, onClose, editingEndpoint, onSecretRevealed }: EndpointFormDialogProps) {
  const qc = useQueryClient()
  const [isPending, startTransition] = useTransition()
  const isEdit = !!editingEndpoint
  const [form, setForm] = useState<EndpointFormState>(
    editingEndpoint ? endpointToForm(editingEndpoint) : DEFAULT_FORM
  )
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose()
      setErrors({})
    }
  }

  const toggleEvent = (event: WebhookEventType) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }))
  }

  const toggleGroup = (groupEvents: readonly WebhookEventType[]) => {
    const allSelected = groupEvents.every((e) => form.events.includes(e))
    setForm((prev) => ({
      ...prev,
      events: allSelected
        ? prev.events.filter((e) => !(groupEvents as readonly string[]).includes(e))
        : [...new Set([...prev.events, ...groupEvents])],
    }))
  }

  const handleSubmit = () => {
    setErrors({})
    startTransition(async () => {
      if (isEdit && editingEndpoint) {
        const result = await updateWebhookEndpoint({
          id: editingEndpoint.id,
          url: form.url,
          events: form.events,
          description: form.description || undefined,
          enabled: editingEndpoint.enabled,
        })
        if ('error' in result && result.error) {
          if (typeof result.error === 'object' && result.error !== null) {
            setErrors(result.error as Record<string, string[]>)
          } else {
            toast.error(typeof result.error === 'string' ? result.error : 'Failed to update endpoint')
          }
          return
        }
        toast.success('Webhook endpoint updated')
        qc.invalidateQueries({ queryKey: ['webhook-endpoints'] })
        onClose()
      } else {
        const result = await createWebhookEndpoint({
          url: form.url,
          events: form.events,
          description: form.description || undefined,
        })
        if ('error' in result && result.error) {
          if (typeof result.error === 'object' && result.error !== null) {
            setErrors(result.error as Record<string, string[]>)
          } else {
            toast.error(typeof result.error === 'string' ? result.error : 'Failed to create endpoint')
          }
          return
        }
        if ('data' in result && result.data) {
          const data = result.data as { secret: string }
          onSecretRevealed(data.secret)
        }
        toast.success('Webhook endpoint created')
        qc.invalidateQueries({ queryKey: ['webhook-endpoints'] })
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Endpoint' : 'Add Webhook Endpoint'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the URL, description, or subscribed events.'
              : 'Configure a URL to receive webhook event notifications.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* URL */}
          <div className="space-y-1.5">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="font-mono text-sm"
            />
            {errors.url && <p className="text-xs text-destructive">{errors.url[0]}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="webhook-desc">Description (optional)</Label>
            <Input
              id="webhook-desc"
              placeholder="e.g. Production integration"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description[0]}</p>}
          </div>

          {/* Events */}
          <div className="space-y-3">
            <Label>Subscribed Events</Label>
            {errors.events && <p className="text-xs text-destructive">{errors.events[0]}</p>}

            <div className="space-y-4 rounded-lg border border-border p-4">
              {(Object.entries(WEBHOOK_EVENT_GROUPS) as [string, readonly WebhookEventType[]][]).map(
                ([group, events], groupIdx, groupArr) => {
                  const allChecked = events.every((e) => form.events.includes(e))
                  const someChecked = events.some((e) => form.events.includes(e))
                  const isLast = groupIdx === groupArr.length - 1

                  return (
                    <div key={group}>
                      <label className="flex items-center gap-2.5 cursor-pointer mb-2">
                        <Checkbox
                          checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                          onCheckedChange={() => toggleGroup(events)}
                        />
                        <span className="text-sm font-semibold text-foreground">{group}</span>
                      </label>
                      <div className="ml-7 space-y-1.5">
                        {events.map((event) => (
                          <label key={event} className="flex items-center gap-2.5 cursor-pointer">
                            <Checkbox
                              checked={form.events.includes(event)}
                              onCheckedChange={() => toggleEvent(event)}
                            />
                            <span className="text-sm text-muted-foreground font-mono">{event}</span>
                          </label>
                        ))}
                      </div>
                      {!isLast && <Separator className="mt-3" />}
                    </div>
                  )
                }
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {form.events.length} event{form.events.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !form.url || form.events.length === 0}
          >
            {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Endpoint'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Secret Display Dialog
// ---------------------------------------------------------------------------

interface SecretDialogProps {
  secret: string | null
  onClose: () => void
}

function SecretDialog({ secret, onClose }: SecretDialogProps) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      toast.success('Secret copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }, [secret])

  return (
    <Dialog open={!!secret} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Webhook Signing Secret</DialogTitle>
          <DialogDescription>
            Use this secret to verify webhook signatures. Copy it now -- you will not be able to see it again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
              <code className="flex-1 text-sm font-mono break-all select-all">
                {visible ? secret : '\u2022'.repeat(32)}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? 'Hide secret' : 'Show secret'}
              >
                {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleCopy}
                aria-label="Copy secret"
              >
                {copied ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              This secret is shown only once. Store it securely before closing this dialog.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Endpoint Card
// ---------------------------------------------------------------------------

interface EndpointCardProps {
  endpoint: EndpointRow
  isSelected: boolean
  onSelect: (id: string | null) => void
  onEdit: (ep: EndpointRow) => void
  onSecretRevealed: (secret: string) => void
}

function EndpointCard({ endpoint, isSelected, onSelect, onEdit, onSecretRevealed }: EndpointCardProps) {
  const qc = useQueryClient()
  const [toggling, startToggle] = useTransition()
  const [deleting, setDeleting] = useState(false)
  const [rotating, setRotating] = useState(false)

  const handleToggle = (enabled: boolean) => {
    startToggle(async () => {
      const result = await toggleWebhookEndpoint({ id: endpoint.id, enabled })
      if ('error' in result && result.error) {
        toast.error(typeof result.error === 'string' ? result.error : 'Failed to toggle endpoint')
        return
      }
      qc.invalidateQueries({ queryKey: ['webhook-endpoints'] })
    })
  }

  const handleDelete = async () => {
    setDeleting(true)
    const result = await deleteWebhookEndpoint({ id: endpoint.id })
    if ('error' in result && result.error) {
      toast.error(typeof result.error === 'string' ? result.error : 'Failed to delete endpoint')
    } else {
      toast.success('Endpoint deleted')
      qc.invalidateQueries({ queryKey: ['webhook-endpoints'] })
      if (isSelected) onSelect(null)
    }
    setDeleting(false)
  }

  const handleRotateSecret = async () => {
    setRotating(true)
    const result = await rotateWebhookSecret({ id: endpoint.id })
    if ('error' in result && result.error) {
      toast.error(typeof result.error === 'string' ? result.error : 'Failed to rotate secret')
    } else if ('data' in result && result.data) {
      const data = result.data as { secret: string }
      onSecretRevealed(data.secret)
      toast.success('Secret rotated successfully')
    }
    setRotating(false)
  }

  return (
    <div className={`widget-card group p-4 transition-all ${isSelected ? 'ring-1 ring-primary/30' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Status dot */}
        <div className="mt-1.5 flex-shrink-0">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              endpoint.enabled ? 'bg-emerald-500' : 'bg-muted-foreground'
            }`}
            aria-label={endpoint.enabled ? 'Enabled' : 'Disabled'}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-mono font-medium text-foreground truncate">{endpoint.url}</p>
              {endpoint.description && (
                <p className="mt-0.5 text-xs text-muted-foreground truncate">{endpoint.description}</p>
              )}
            </div>
            <Switch
              size="sm"
              checked={endpoint.enabled}
              onCheckedChange={handleToggle}
              disabled={toggling}
              aria-label={`${endpoint.enabled ? 'Disable' : 'Enable'} endpoint`}
            />
          </div>

          {/* Meta row */}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {endpoint.events.length} event{endpoint.events.length !== 1 ? 's' : ''}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Created {timeAgo(endpoint.created_at)}
            </span>
            {endpoint.updated_at !== endpoint.created_at && (
              <span className="text-xs text-muted-foreground">
                Updated {timeAgo(endpoint.updated_at)}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center gap-1.5">
            <Button
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => onSelect(isSelected ? null : endpoint.id)}
            >
              <Clock className="mr-1 h-3 w-3" />
              {isSelected ? 'Hide Log' : 'View Log'}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onEdit(endpoint)}
              aria-label="Edit endpoint"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={rotating}
                  aria-label="Rotate secret"
                >
                  <RotateCw className={`h-3.5 w-3.5 ${rotating ? 'animate-spin' : ''}`} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rotate Webhook Secret</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will generate a new signing secret. The old secret will stop working immediately.
                    Make sure to update the secret in your receiving application.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRotateSecret}>
                    Rotate Secret
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label="Delete endpoint"
                  disabled={deleting}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Webhook Endpoint</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this endpoint and all its delivery history.
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
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delivery Log Panel
// ---------------------------------------------------------------------------

interface DeliveryLogPanelProps {
  endpointId: string
  endpointUrl: string
}

function DeliveryLogPanel({ endpointId, endpointUrl }: DeliveryLogPanelProps) {
  const qc = useQueryClient()
  const { data: deliveries, isLoading } = useWebhookDeliveries(endpointId)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  const handleRetry = async (deliveryId: string) => {
    setRetryingId(deliveryId)
    const result = await retryWebhookDelivery({ deliveryId })
    if ('error' in result && result.error) {
      toast.error(typeof result.error === 'string' ? result.error : 'Failed to retry delivery')
    } else {
      toast.success('Delivery queued for retry')
      qc.invalidateQueries({ queryKey: ['webhook-deliveries', endpointId] })
    }
    setRetryingId(null)
  }

  return (
    <div className="widget-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Delivery Log</h3>
            <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{endpointUrl}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => qc.invalidateQueries({ queryKey: ['webhook-deliveries', endpointId] })}
            aria-label="Refresh deliveries"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : !deliveries?.length ? (
        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
          <Clock className="h-5 w-5 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No deliveries yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Deliveries will appear here when events are triggered
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Event</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Code</TableHead>
              <TableHead className="text-xs">Attempts</TableHead>
              <TableHead className="text-xs">Time</TableHead>
              <TableHead className="text-xs w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">{d.event_type}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-xs gap-1 ${statusBadgeClasses(d.status)}`}
                  >
                    {statusIcon(d.status)}
                    {d.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {d.response_code ?? '--'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {d.attempts}/{d.max_attempts}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {timeAgo(d.created_at)}
                </TableCell>
                <TableCell>
                  {(d.status === 'failed' || d.status === 'exhausted') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRetry(d.id)}
                      disabled={retryingId === d.id}
                      aria-label="Retry delivery"
                    >
                      <RotateCw className={`h-3 w-3 ${retryingId === d.id ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function WebhooksDashboard() {
  const { data: endpoints, isLoading } = useWebhookEndpoints()
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingEndpoint, setEditingEndpoint] = useState<EndpointRow | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)

  // Dialog key forces re-mount (and form reset) when switching between create/edit
  const [dialogKey, setDialogKey] = useState(0)

  const handleAddClick = () => {
    setEditingEndpoint(null)
    setDialogKey((k) => k + 1)
    setIsCreateOpen(true)
  }

  const handleEditClick = (ep: EndpointRow) => {
    setEditingEndpoint(ep)
    setDialogKey((k) => k + 1)
    setIsCreateOpen(true)
  }

  const handleDialogClose = () => {
    setIsCreateOpen(false)
    setEditingEndpoint(null)
  }

  const enabledCount = (endpoints ?? []).filter((ep) => ep.enabled).length
  const totalCount = (endpoints ?? []).length

  const selectedEp = endpoints?.find((ep) => ep.id === selectedEndpoint) ?? null

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="widget-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Webhook className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Webhooks</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Send real-time event notifications to external services when TMS events occur
              </p>
            </div>
          </div>
          <Button size="sm" onClick={handleAddClick} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Endpoint
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

      {/* Endpoints list */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
          Endpoints
        </h3>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : !endpoints?.length ? (
          <div className="widget-card flex flex-col items-center justify-center py-14 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Webhook className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No webhook endpoints</p>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              Add an endpoint to start receiving real-time notifications when orders, trips, or billing events occur.
            </p>
            <Button size="sm" onClick={handleAddClick}>
              <Plus className="mr-1.5 h-4 w-4" />
              Create your first endpoint
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {endpoints.map((ep) => (
              <EndpointCard
                key={ep.id}
                endpoint={ep}
                isSelected={selectedEndpoint === ep.id}
                onSelect={setSelectedEndpoint}
                onEdit={handleEditClick}
                onSecretRevealed={setNewSecret}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delivery log panel */}
      {selectedEp && (
        <DeliveryLogPanel endpointId={selectedEp.id} endpointUrl={selectedEp.url} />
      )}

      {/* Create/Edit dialog */}
      <EndpointFormDialog
        key={dialogKey}
        open={isCreateOpen}
        onClose={handleDialogClose}
        editingEndpoint={editingEndpoint}
        onSecretRevealed={setNewSecret}
      />

      {/* Secret display dialog */}
      <SecretDialog secret={newSecret} onClose={() => setNewSecret(null)} />
    </div>
  )
}
