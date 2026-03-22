'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { suspendTenant, unsuspendTenant, extendTrial } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ShieldOff, ShieldCheck, CalendarPlus, Loader2 } from 'lucide-react'

interface TenantActionsProps {
  tenantId: string
  tenantName: string
  isSuspended: boolean
  onActionComplete?: () => void
}

// ── Suspend ────────────────────────────────────────────────────────────────────
function SuspendButton({
  tenantId,
  tenantName,
  onSuccess,
}: {
  tenantId: string
  tenantName: string
  onSuccess?: () => void
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function handleSuspend() {
    if (!reason.trim()) return
    setLoading(true)
    try {
      const result = await suspendTenant(tenantId, reason.trim())
      if ('error' in result) {
        toast.error(typeof result.error === 'string' ? result.error : 'Failed to suspend tenant')
      } else {
        toast.success(`${tenantName} has been suspended`)
        setOpen(false)
        setReason('')
        onSuccess?.()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40">
          <ShieldOff className="h-4 w-4" />
          Suspend Tenant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend {tenantName}?</DialogTitle>
          <DialogDescription>
            This will block all users in this tenant from accessing VroomX. You must provide a reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="suspend-reason">Reason</Label>
            <Textarea
              id="suspend-reason"
              placeholder="e.g. Payment overdue for 60+ days, fraud investigation..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{reason.length}/500</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSuspend}
            disabled={loading || !reason.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Suspending...
              </>
            ) : (
              'Suspend Tenant'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Unsuspend ──────────────────────────────────────────────────────────────────
function UnsuspendButton({
  tenantId,
  tenantName,
  onSuccess,
}: {
  tenantId: string
  tenantName: string
  onSuccess?: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleUnsuspend() {
    setLoading(true)
    try {
      const result = await unsuspendTenant(tenantId)
      if ('error' in result) {
        toast.error(typeof result.error === 'string' ? result.error : 'Failed to unsuspend tenant')
      } else {
        toast.success(`${tenantName} has been unsuspended`)
        onSuccess?.()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40">
          <ShieldCheck className="h-4 w-4" />
          Unsuspend Tenant
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsuspend {tenantName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will restore full access for all users in this tenant.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUnsuspend}
            disabled={loading}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Unsuspending...
              </>
            ) : (
              'Confirm Unsuspend'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Extend Trial ───────────────────────────────────────────────────────────────
function ExtendTrialButton({
  tenantId,
  tenantName,
  onSuccess,
}: {
  tenantId: string
  tenantName: string
  onSuccess?: () => void
}) {
  const [days, setDays] = useState('14')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function handleExtend() {
    const daysNum = parseInt(days, 10)
    if (!daysNum || daysNum < 1 || daysNum > 90) {
      toast.error('Days must be between 1 and 90')
      return
    }
    setLoading(true)
    try {
      const result = await extendTrial(tenantId, daysNum)
      if ('error' in result) {
        toast.error(typeof result.error === 'string' ? result.error : 'Failed to extend trial')
      } else {
        const newEnd = result.data?.newTrialEnd
          ? new Date(result.data.newTrialEnd).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : ''
        toast.success(
          `Trial extended by ${daysNum} days${newEnd ? ` — new end: ${newEnd}` : ''}`
        )
        setOpen(false)
        setDays('14')
        onSuccess?.()
      }
    } finally {
      setLoading(false)
    }
  }

  const daysNum = parseInt(days, 10)
  const isValid = !isNaN(daysNum) && daysNum >= 1 && daysNum <= 90

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarPlus className="h-4 w-4" />
          Extend Trial
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend Trial for {tenantName}</DialogTitle>
          <DialogDescription>
            Extend the trial period from the current trial end date. Maximum 90 days per extension.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="extend-days">Number of days</Label>
            <Input
              id="extend-days"
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Enter 1–90 days. The trial will be extended from the current trial end date.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleExtend} disabled={loading || !isValid}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extending...
              </>
            ) : (
              `Extend by ${isValid ? daysNum : '?'} day${daysNum !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Composed actions panel ─────────────────────────────────────────────────────
export function TenantActions({
  tenantId,
  tenantName,
  isSuspended,
  onActionComplete,
}: TenantActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {isSuspended ? (
        <UnsuspendButton
          tenantId={tenantId}
          tenantName={tenantName}
          onSuccess={onActionComplete}
        />
      ) : (
        <SuspendButton
          tenantId={tenantId}
          tenantName={tenantName}
          onSuccess={onActionComplete}
        />
      )}
      <ExtendTrialButton
        tenantId={tenantId}
        tenantName={tenantName}
        onSuccess={onActionComplete}
      />
    </div>
  )
}
