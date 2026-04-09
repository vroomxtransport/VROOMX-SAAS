'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { verifyAuditIntegrity } from '@/app/actions/audit'
import { ShieldCheck, ShieldAlert, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IntegrityResult {
  valid: boolean
  totalChecked: number
  firstBroken?: {
    id: string
    created_at: string
    expected: string
    actual: string
  }
}

function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 16) // "YYYY-MM-DDTHH:mm"
}

export function IntegrityTab() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<IntegrityResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Default: last 30 days
  const defaultEnd = new Date()
  const defaultStart = new Date(defaultEnd)
  defaultStart.setDate(defaultStart.getDate() - 30)

  const [startDate, setStartDate] = useState(formatDateForInput(defaultStart))
  const [endDate, setEndDate] = useState(formatDateForInput(defaultEnd))

  function handleVerify() {
    setResult(null)
    setError(null)

    startTransition(async () => {
      const res = await verifyAuditIntegrity({
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      })

      if ('error' in res) {
        setError(typeof res.error === 'string' ? res.error : 'Verification failed. Please try again.')
        return
      }

      if (res.success && res.data) {
        setResult(res.data as IntegrityResult)
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Description card */}
      <div className="rounded-xl border border-border-subtle bg-surface p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2 shrink-0 mt-0.5">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Hash Chain Verification</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Each audit log entry includes a cryptographic hash linking it to the previous entry.
              Verifying the chain detects any tampering, deletion, or insertion of log entries
              outside the normal application flow.
            </p>
          </div>
        </div>
      </div>

      {/* Date range input */}
      <div className="rounded-xl border border-border-subtle bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Verification Range</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="startDate" className="text-xs font-medium text-muted-foreground">
              Start Date
            </Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate" className="text-xs font-medium text-muted-foreground">
              End Date
            </Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        <Button
          onClick={handleVerify}
          disabled={isPending || !startDate || !endDate}
          className="gap-1.5"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Verify Integrity
            </>
          )}
        </Button>

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>

      {/* Results */}
      {result && (
        <div
          className={cn(
            'rounded-xl border p-5 space-y-4',
            result.valid
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-red-500/30 bg-red-500/5'
          )}
        >
          {/* Status header */}
          <div className="flex items-center gap-3">
            {result.valid ? (
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <div>
              <p
                className={cn(
                  'text-sm font-semibold',
                  result.valid ? 'text-emerald-700' : 'text-red-700'
                )}
              >
                {result.valid ? 'Chain intact — no tampering detected' : 'Chain broken — tampering detected'}
              </p>
              <p className={cn('text-xs mt-0.5', result.valid ? 'text-emerald-600' : 'text-red-600')}>
                {result.totalChecked.toLocaleString()} record{result.totalChecked !== 1 ? 's' : ''} verified
              </p>
            </div>
          </div>

          {/* Broken link details */}
          {!result.valid && result.firstBroken && (
            <div className="rounded-lg border border-red-500/20 bg-background/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">
                  First broken link
                </p>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Record ID</p>
                  <p className="font-mono text-xs text-foreground break-all">{result.firstBroken.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Timestamp</p>
                  <p className="font-mono text-xs text-foreground">
                    {new Date(result.firstBroken.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Expected hash</p>
                  <p className="font-mono text-[11px] text-emerald-700 break-all bg-emerald-500/5 rounded px-2 py-1">
                    {result.firstBroken.expected}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Actual hash stored</p>
                  <p className="font-mono text-[11px] text-red-700 break-all bg-red-500/5 rounded px-2 py-1">
                    {result.firstBroken.actual || '(empty)'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground border-t border-border-subtle pt-3">
                This discrepancy indicates the audit record may have been tampered with or the chain
                was interrupted. Contact your VroomX administrator or security team to investigate.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
