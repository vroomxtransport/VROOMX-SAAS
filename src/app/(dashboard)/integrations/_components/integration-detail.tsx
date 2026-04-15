'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle,
  ExternalLink,
  Loader2,
  Plug,
  RefreshCw,
  Settings,
  Truck,
  Unplug,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { IntegrationStatus, StatusDot } from './integration-status'
import { SamsaraVehicleMapping } from '@/app/(dashboard)/settings/_components/samsara-vehicle-mapping'
import { SamsaraDriverMapping } from '@/app/(dashboard)/settings/_components/samsara-driver-mapping'
import {
  getSamsaraStatus,
  connectSamsara,
  disconnectSamsara,
  triggerFullSync,
  getVroomxOptions,
} from '@/app/actions/samsara'
import type {
  SamsaraStatus as SamsaraStatusType,
  VroomxTruckOption,
  VroomxDriverOption,
} from '@/app/actions/samsara'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { IntegrationDefinition } from '@/lib/integrations/registry'
import { CATEGORY_LABELS } from '@/lib/integrations/registry'

// ---------------------------------------------------------------------------
// Step icons
// ---------------------------------------------------------------------------

const STEP_ICONS = [Plug, Settings, RefreshCw] as const

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IntegrationDetailProps {
  integration: IntegrationDefinition
  initialConnected?: boolean
}

// ---------------------------------------------------------------------------
// Samsara-specific: Connect dialog
// ---------------------------------------------------------------------------

function ConnectDialog({ onConnected }: { onConnected: () => void }) {
  const [open, setOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)

  async function handleConnect() {
    if (!apiKey.trim()) {
      toast.error('Please enter your Samsara API key')
      return
    }
    setConnecting(true)
    try {
      const result = await connectSamsara({ apiKey: apiKey.trim() })
      if ('error' in result && result.error) {
        toast.error(typeof result.error === 'string' ? result.error : 'Failed to connect')
      } else {
        toast.success('Samsara account connected successfully')
        setOpen(false)
        setApiKey('')
        onConnected()
      }
    } catch {
      toast.error('Failed to connect to Samsara')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Plug className="h-4 w-4" />
          Connect Samsara
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Samsara</DialogTitle>
          <DialogDescription>
            Enter your Samsara API key. You can find it in the Samsara Dashboard
            under Settings &rsaquo; API Tokens.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="detail-samsara-api-key">API Key</Label>
            <Input
              id="detail-samsara-api-key"
              type="password"
              placeholder="samsara_api_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              disabled={connecting}
              autoComplete="off"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Your API key is stored encrypted and is never exposed in the UI.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={connecting}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={connecting || !apiKey.trim()}>
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plug className="h-4 w-4" />
                Connect
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Samsara-specific: Disconnect dialog
// ---------------------------------------------------------------------------

function DisconnectDialog({ onDisconnected }: { onDisconnected: () => void }) {
  const [open, setOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const result = await disconnectSamsara()
      if ('error' in result && result.error) {
        toast.error(typeof result.error === 'string' ? result.error : 'Failed to disconnect')
      } else {
        toast.success('Samsara account disconnected')
        setOpen(false)
        onDisconnected()
      }
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
          <Unplug className="h-4 w-4" />
          Disconnect
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Disconnect Samsara?</DialogTitle>
          <DialogDescription>
            This will remove your Samsara API key and all vehicle/driver mappings.
            Your VroomX data will not be deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={disconnecting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Disconnecting...
              </>
            ) : (
              <>
                <Unplug className="h-4 w-4" />
                Disconnect
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Main detail component
// ---------------------------------------------------------------------------

export function IntegrationDetail({ integration, initialConnected }: IntegrationDetailProps) {
  const isSamsara = integration.slug === 'samsara'
  const isComingSoon = integration.status === 'coming_soon'

  // Samsara state
  const [samsaraStatus, setSamsaraStatus] = useState<SamsaraStatusType | null>(null)
  const [trucks, setTrucks] = useState<VroomxTruckOption[]>([])
  const [vroomxDrivers, setVroomxDrivers] = useState<VroomxDriverOption[]>([])
  const [loading, setLoading] = useState(isSamsara)
  const [syncing, setSyncing] = useState(false)
  const [notified, setNotified] = useState(false)

  const loadSamsara = useCallback(async () => {
    if (!isSamsara) return
    setLoading(true)
    try {
      const [statusResult, optionsResult] = await Promise.all([
        getSamsaraStatus(),
        getVroomxOptions(),
      ])
      if ('success' in statusResult) {
        setSamsaraStatus(statusResult.data)
      }
      if ('success' in optionsResult) {
        setTrucks(optionsResult.trucks)
        setVroomxDrivers(optionsResult.drivers)
      }
    } catch {
      toast.error('Failed to load integration data')
    } finally {
      setLoading(false)
    }
  }, [isSamsara])

  useEffect(() => {
    loadSamsara()
  }, [loadSamsara])

  async function handleSyncNow() {
    setSyncing(true)
    try {
      const result = await triggerFullSync()
      if ('error' in result && result.error) {
        toast.error(typeof result.error === 'string' ? result.error : 'Sync failed')
      } else {
        toast.success('Sync started -- vehicle and driver data will update shortly')
        await loadSamsara()
      }
    } catch {
      toast.error('Failed to trigger sync')
    } finally {
      setSyncing(false)
    }
  }

  // Derived state
  const isConnected = isSamsara ? (samsaraStatus?.connected ?? false) : false
  const lastSyncText = samsaraStatus?.lastSyncAt
    ? formatDistanceToNow(new Date(samsaraStatus.lastSyncAt), { addSuffix: true })
    : null
  const isSyncing = syncing || samsaraStatus?.connectionStatus === 'paused'
  const hasError = samsaraStatus?.connectionStatus === 'error'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Integrations
      </Link>

      {/* Hero header */}
      <div
        className="animate-fade-up flex flex-col gap-4 sm:flex-row sm:items-center"
        style={{ animationDelay: '0ms' }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-white shadow-sm shrink-0 overflow-hidden p-2">
          <Image
            src={integration.logo}
            alt={integration.name}
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
            onError={(e) => {
              const target = e.currentTarget.parentElement
              if (target) {
                target.style.backgroundColor = integration.brandColor
                target.style.border = 'none'
                target.innerHTML = `<span class="text-white font-bold text-2xl select-none">${integration.name.charAt(0)}</span>`
              }
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {integration.name}
            </h1>
            <Badge variant="secondary" className="text-xs">
              {CATEGORY_LABELS[integration.category]}
            </Badge>
            {integration.tags.includes('official') && (
              <Badge className="text-blue-700 text-xs">
                Official
              </Badge>
            )}
            {isComingSoon && (
              <Badge variant="outline" className="text-xs">
                Coming Soon
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3">
            {!isComingSoon && !loading && (
              <IntegrationStatus
                connected={isConnected}
                syncing={isSyncing}
                error={hasError ? (samsaraStatus?.syncError ?? 'Connection error') : undefined}
                lastSync={lastSyncText ?? undefined}
              />
            )}
            {isComingSoon && (
              <p className="text-sm text-muted-foreground">{integration.description}</p>
            )}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading status...
              </div>
            )}
          </div>
        </div>
        {integration.externalUrl && (
          <a
            href={integration.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            Visit website
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          <section
            className="widget-card animate-fade-up"
            style={{ animationDelay: '80ms' }}
          >
            <h2 className="text-sm font-semibold text-foreground mb-3">About</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {integration.longDescription}
            </p>
          </section>

          {/* Features */}
          <section
            className="widget-card animate-fade-up"
            style={{ animationDelay: '160ms' }}
          >
            <h2 className="text-sm font-semibold text-foreground mb-3">Features</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {integration.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
          </section>

          {/* How it works */}
          <section
            className="widget-card animate-fade-up"
            style={{ animationDelay: '240ms' }}
          >
            <h2 className="text-sm font-semibold text-foreground mb-4">How it Works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {integration.steps.map((step, i) => {
                const StepIcon = STEP_ICONS[i] ?? RefreshCw
                return (
                  <div
                    key={step.title}
                    className="relative rounded-lg border border-border bg-card p-4 text-center"
                  >
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <StepIcon className="h-5 w-5" />
                    </div>
                    <span className="absolute top-3 left-3 text-xs font-bold text-muted-foreground/50">
                      {i + 1}
                    </span>
                    <h3 className="text-sm font-medium text-foreground">{step.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* Right column -- sidebar */}
        <div className="space-y-6">
          {/* Status card */}
          {isComingSoon ? (
            <div
              className="glass-card rounded-xl p-5 animate-fade-up"
              style={{ animationDelay: '100ms' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <StatusDot connected={false} />
                <span className="text-sm font-medium text-muted-foreground">Coming Soon</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                This integration is coming soon. We will notify you when it is ready.
              </p>
              <Button
                className="w-full"
                variant={notified ? 'outline' : 'default'}
                onClick={() => {
                  setNotified(true)
                  toast.success(`We'll notify you when ${integration.name} is available`)
                }}
                disabled={notified}
              >
                {notified ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Subscribed
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4" />
                    Notify Me
                  </>
                )}
              </Button>
            </div>
          ) : loading ? (
            <div
              className="glass-card rounded-xl p-5 animate-fade-up"
              style={{ animationDelay: '100ms' }}
            >
              <div className="h-40 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : isConnected && samsaraStatus ? (
            <div
              className="glass-card rounded-xl p-5 animate-fade-up"
              style={{ animationDelay: '100ms' }}
            >
              {/* Connected header */}
              <div className="flex items-center gap-2 mb-4">
                <StatusDot
                  connected
                  syncing={isSyncing}
                  error={hasError}
                />
                <span className="text-sm font-medium text-emerald-600">
                  Connected
                </span>
              </div>

              {/* Last sync */}
              {lastSyncText && (
                <p className="text-xs text-muted-foreground mb-4">
                  Last sync: <span className="font-medium text-foreground">{lastSyncText}</span>
                </p>
              )}

              {/* Stats */}
              <div className="space-y-2.5 mb-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Truck className="h-4 w-4" />
                    Vehicles
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {samsaraStatus.vehicleCount} synced
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    Drivers
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {samsaraStatus.driverCount} synced
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4" />
                    Mapped
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {samsaraStatus.mappedVehicleCount} vehicles
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Sync Now
                    </>
                  )}
                </Button>
                <DisconnectDialog onDisconnected={loadSamsara} />
              </div>

              {/* Sync error */}
              {samsaraStatus.syncError && (
                <p className="mt-3 text-xs text-destructive">
                  {samsaraStatus.syncError}
                </p>
              )}
            </div>
          ) : (
            /* Disconnected / ready to connect */
            <div
              className="glass-card rounded-xl p-5 animate-fade-up"
              style={{ animationDelay: '100ms' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <StatusDot connected={false} />
                <span className="text-sm font-medium text-muted-foreground">Ready to connect</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Connect your {integration.name} account to start syncing data with VroomX.
              </p>
              {isSamsara && <ConnectDialog onConnected={loadSamsara} />}
            </div>
          )}
        </div>
      </div>

      {/* Full-width mapping sections (Samsara only, when connected) */}
      {isSamsara && isConnected && samsaraStatus && !loading && (
        <div className="space-y-6">
          {/* Vehicle Mapping */}
          <section
            className="widget-card animate-fade-up"
            style={{ animationDelay: '320ms' }}
          >
            <div className="widget-header">
              <div className="widget-title">
                <Truck className="h-4 w-4 text-muted-foreground" />
                Vehicle Mapping
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Map Samsara vehicles to VroomX trucks to enable GPS tracking on trips.
            </p>
            <SamsaraVehicleMapping vehicles={samsaraStatus.vehicles} trucks={trucks} />
          </section>

          {/* Driver Mapping */}
          <section
            className="widget-card animate-fade-up"
            style={{ animationDelay: '400ms' }}
          >
            <div className="widget-header">
              <div className="widget-title">
                <User className="h-4 w-4 text-muted-foreground" />
                Driver Mapping
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Map Samsara drivers to VroomX drivers for ELD compliance and HOS tracking.
            </p>
            <SamsaraDriverMapping drivers={samsaraStatus.drivers} vroomxDrivers={vroomxDrivers} />
          </section>
        </div>
      )}
    </div>
  )
}
