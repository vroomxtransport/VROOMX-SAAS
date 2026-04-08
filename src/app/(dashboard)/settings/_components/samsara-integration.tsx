'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import {
  Plug,
  Unplug,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Truck,
  User,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { SamsaraVehicleMapping } from './samsara-vehicle-mapping'
import { SamsaraDriverMapping } from './samsara-driver-mapping'
import {
  getSamsaraStatus,
  connectSamsara,
  disconnectSamsara,
  triggerFullSync,
  getVroomxOptions,
} from '@/app/actions/samsara'
import type {
  SamsaraStatus,
  VroomxTruckOption,
  VroomxDriverOption,
} from '@/app/actions/samsara'

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function ConnectionBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
        <CheckCircle className="h-3 w-3" />
        Connected
      </Badge>
    )
  }
  if (status === 'paused') {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Syncing
      </Badge>
    )
  }
  if (status === 'error') {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        Error
      </Badge>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Connect dialog
// ---------------------------------------------------------------------------

interface ConnectDialogProps {
  onConnected: () => void
}

function ConnectDialog({ onConnected }: ConnectDialogProps) {
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
        return
      }

      toast.success('Connected! Importing your fleet data…')
      setOpen(false)
      setApiKey('')

      // Auto-sync immediately after connecting
      const syncResult = await triggerFullSync()
      if ('error' in syncResult && syncResult.error) {
        toast.error(typeof syncResult.error === 'string' ? syncResult.error : 'Sync failed')
      } else if ('warnings' in syncResult && (syncResult.warnings as string[])?.length) {
        toast.success('Fleet data imported with some warnings')
      } else {
        toast.success('Fleet data imported successfully')
      }

      onConnected()
    } catch {
      toast.error('Failed to connect to Samsara')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plug className="h-4 w-4" />
          Connect Samsara
          <ExternalLink className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Samsara</DialogTitle>
          <DialogDescription>
            Enter your Samsara API key to connect your fleet management account. You can find your
            API key in the Samsara Dashboard under Settings &rsaquo; API Tokens.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="samsara-api-key">API Key</Label>
            <Input
              id="samsara-api-key"
              type="password"
              placeholder="samsara_api_…"
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
                Connecting…
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
// Disconnect confirm dialog
// ---------------------------------------------------------------------------

interface DisconnectDialogProps {
  onDisconnected: () => void
}

function DisconnectDialog({ onDisconnected }: DisconnectDialogProps) {
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
        <Button variant="destructive" size="sm">
          <Unplug className="h-4 w-4" />
          Disconnect
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Disconnect Samsara?</DialogTitle>
          <DialogDescription>
            This will remove your Samsara API key and all vehicle/driver mappings. Your VroomX data
            will not be deleted. This action cannot be undone.
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
                Disconnecting…
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
// Main component
// ---------------------------------------------------------------------------

export function SamsaraIntegration() {
  const [status, setStatus] = useState<SamsaraStatus | null>(null)
  const [trucks, setTrucks] = useState<VroomxTruckOption[]>([])
  const [vroomxDrivers, setVroomxDrivers] = useState<VroomxDriverOption[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statusResult, optionsResult] = await Promise.all([
        getSamsaraStatus(),
        getVroomxOptions(),
      ])

      if ('error' in statusResult && statusResult.error) {
        toast.error('Failed to load Samsara status')
      } else if ('success' in statusResult) {
        setStatus(statusResult.data)
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
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSyncNow() {
    setSyncing(true)
    try {
      const result = await triggerFullSync()
      if ('error' in result && result.error) {
        toast.error(typeof result.error === 'string' ? result.error : 'Sync failed')
      } else if ('warnings' in result && (result.warnings as string[])?.length) {
        toast.success('Sync completed with some warnings')
        await load()
      } else {
        toast.success('Sync completed — fleet data updated')
        await load()
      }
    } catch {
      toast.error('Failed to trigger sync')
    } finally {
      setSyncing(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Skeleton loader
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <Card>
        <CardHeader className="px-6">
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Samsara Integration
          </CardTitle>
          <CardDescription>Loading integration status…</CardDescription>
        </CardHeader>
        <CardContent className="px-6">
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    )
  }

  // ---------------------------------------------------------------------------
  // Not connected state
  // ---------------------------------------------------------------------------

  if (!status || !status.connected) {
    return (
      <Card>
        <CardHeader className="px-6">
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Samsara Integration
          </CardTitle>
          <CardDescription>
            Connect your Samsara fleet management account to sync vehicles, drivers, GPS tracking,
            ELD compliance, and safety events.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6">
          <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Not connected</p>
              <p className="text-xs text-muted-foreground">
                Link your Samsara account to enable GPS tracking and ELD compliance data in VroomX.
              </p>
            </div>
            <ConnectDialog onConnected={load} />
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---------------------------------------------------------------------------
  // Connected state
  // ---------------------------------------------------------------------------

  const lastSync = status.lastSyncAt
    ? formatDistanceToNow(new Date(status.lastSyncAt), { addSuffix: true })
    : 'Never'

  return (
    <Card>
      <CardHeader className="px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Samsara Integration
            </CardTitle>
            <CardDescription className="mt-1">
              Fleet management data synced from Samsara.
            </CardDescription>
          </div>
          {/* Status badge + action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionBadge status={status.connectionStatus} />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncNow}
              disabled={syncing || status.connectionStatus === 'paused'}
            >
              {syncing || status.connectionStatus === 'paused' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sync Now
                </>
              )}
            </Button>
            <DisconnectDialog onDisconnected={load} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 space-y-6">
        {/* Sync metadata */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Last sync: <span className="font-medium text-foreground">{lastSync}</span></span>
          {status.syncError && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {status.syncError}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Truck className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Vehicles</span>
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {status.vehicleCount}
            </p>
            <p className="text-xs text-muted-foreground">synced</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Drivers</span>
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {status.driverCount}
            </p>
            <p className="text-xs text-muted-foreground">synced</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Mapped</span>
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
              {status.mappedVehicleCount}
            </p>
            <p className="text-xs text-muted-foreground">vehicles</p>
          </div>
        </div>

        {/* Vehicle mapping table */}
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Truck className="h-4 w-4 text-muted-foreground" />
            Vehicle Mapping
          </h4>
          <p className="text-xs text-muted-foreground">
            Map Samsara vehicles to VroomX trucks to enable GPS tracking on trips.
          </p>
          <SamsaraVehicleMapping vehicles={status.vehicles} trucks={trucks} />
        </div>

        {/* Driver mapping table */}
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <User className="h-4 w-4 text-muted-foreground" />
            Driver Mapping
          </h4>
          <p className="text-xs text-muted-foreground">
            Map Samsara drivers to VroomX drivers for ELD compliance and HOS tracking.
          </p>
          <SamsaraDriverMapping drivers={status.drivers} vroomxDrivers={vroomxDrivers} />
        </div>
      </CardContent>
    </Card>
  )
}
