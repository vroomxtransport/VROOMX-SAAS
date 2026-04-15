'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Clock,
  Plus,
  Trash2,
  Loader2,
  Calendar,
  FileText,
  FileSpreadsheet,
  File,
  Mail,
  X,
  CalendarClock,
} from 'lucide-react'
import {
  createScheduledReport,
  deleteScheduledReport,
  toggleScheduledReport,
} from '@/app/actions/scheduled-reports'
import {
  SCHEDULE_LABELS,
  FORMAT_LABELS,
  SCHEDULE_OPTIONS,
  FORMAT_OPTIONS,
  type ScheduleOption,
  type FormatOption,
} from '@/lib/validations/scheduled-reports'
import type { ScheduledReportRow } from '@/lib/queries/scheduled-reports'
import type { SavedReport } from '@/lib/reports/report-config'
import { cn } from '@/lib/utils'

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const FORMAT_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  excel: FileSpreadsheet,
  csv: File,
}

// ============================================================================
// Create / Edit Dialog
// ============================================================================

interface ScheduleDialogProps {
  open: boolean
  onClose: () => void
  availableReports: SavedReport[]
  onCreated: (row: ScheduledReportRow) => void
}

function ScheduleDialog({ open, onClose, availableReports, onCreated }: ScheduleDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [reportId, setReportId] = useState('')
  const [schedule, setSchedule] = useState<ScheduleOption>('weekly_monday')
  const [format, setFormat] = useState<FormatOption>('pdf')
  const [recipientInput, setRecipientInput] = useState('')
  const [recipients, setRecipients] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  function addRecipient() {
    const email = recipientInput.trim().toLowerCase()
    if (!email || recipients.includes(email)) {
      setRecipientInput('')
      return
    }
    // Basic email pattern check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrors((e) => ({ ...e, recipients: ['Enter a valid email address'] }))
      return
    }
    setFieldErrors((e) => { const next = { ...e }; delete next.recipients; return next })
    setRecipients((prev) => [...prev, email])
    setRecipientInput('')
  }

  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((r) => r !== email))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addRecipient()
    }
  }

  function resetForm() {
    setReportId('')
    setSchedule('weekly_monday')
    setFormat('pdf')
    setRecipients([])
    setRecipientInput('')
    setFieldErrors({})
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await createScheduledReport({ reportId, schedule, recipients, format, enabled: true })

      if ('error' in result) {
        if (typeof result.error === 'object' && result.error !== null) {
          setFieldErrors(result.error as Record<string, string[]>)
        } else {
          setFieldErrors({ _form: [String(result.error)] })
        }
        return
      }

      if ('data' in result && result.data) {
        // Attach the report name from our local list
        const matchedReport = availableReports.find((r) => r.id === reportId)
        const row: ScheduledReportRow = {
          ...(result.data as ScheduledReportRow),
          recipients,
          report_name: matchedReport?.name ?? null,
        }
        onCreated(row)
        handleClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4.5 w-4.5 text-brand" />
            Schedule a Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Report selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Report</Label>
            <Select value={reportId} onValueChange={setReportId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select a report…" />
              </SelectTrigger>
              <SelectContent>
                {availableReports.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-sm">
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.reportId && (
              <p className="text-xs text-red-500">{fieldErrors.reportId[0]}</p>
            )}
          </div>

          {/* Schedule */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Frequency</Label>
            <Select value={schedule} onValueChange={(v) => setSchedule(v as ScheduleOption)}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="text-sm">
                    {SCHEDULE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">File Format</Label>
            <div className="flex items-center gap-2">
              {FORMAT_OPTIONS.map((f) => {
                const Icon = FORMAT_ICONS[f]
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                      format === f
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border text-muted-foreground hover:border-brand/50 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {FORMAT_LABELS[f]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Recipients */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Recipients</Label>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                placeholder="name@company.com"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={addRecipient}
                className="text-sm flex-1"
              />
              <Button type="button" size="sm" variant="outline" onClick={addRecipient} className="shrink-0">
                Add
              </Button>
            </div>
            {fieldErrors.recipients && (
              <p className="text-xs text-red-500">{fieldErrors.recipients[0]}</p>
            )}
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeRecipient(email)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {fieldErrors._form && (
            <p className="text-xs text-red-500">{fieldErrors._form[0]}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending || !reportId || recipients.length === 0}
          >
            {isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</>
            ) : (
              <><CalendarClock className="h-3.5 w-3.5 mr-1.5" />Create Schedule</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Empty state
// ============================================================================

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="widget-card flex flex-col items-center justify-center py-20 text-center">
      <CalendarClock className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-base font-medium text-foreground mb-1">No scheduled reports yet</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-[42ch]">
        Set up automatic report delivery to keep your team informed without manual exports
      </p>
      <Button className="text-sm" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-1.5" />
        Schedule a Report
      </Button>
    </div>
  )
}

// ============================================================================
// Schedule card
// ============================================================================

interface ScheduleCardProps {
  schedule: ScheduledReportRow
  onToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
  deletingId: string | null
  togglingId: string | null
}

function ScheduleCard({ schedule, onToggle, onDelete, deletingId, togglingId }: ScheduleCardProps) {
  const FormatIcon = FORMAT_ICONS[schedule.format] ?? File
  const isDeleting = deletingId === schedule.id
  const isToggling = togglingId === schedule.id

  return (
    <div
      className={cn(
        'widget-card transition-opacity duration-200',
        !schedule.enabled && 'opacity-60'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
            <CalendarClock className="h-4.5 w-4.5 text-brand" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate leading-tight">
              {schedule.report_name ?? 'Unnamed report'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {schedule.recipients.length} recipient{schedule.recipients.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={schedule.enabled}
            onCheckedChange={(checked) => onToggle(schedule.id, checked)}
            disabled={isToggling}
            size="sm"
            aria-label={schedule.enabled ? 'Disable schedule' : 'Enable schedule'}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(schedule.id)}
            disabled={isDeleting}
            className={cn(
              'h-7 w-7 p-0 transition-colors',
              isDeleting
                ? 'text-muted-foreground'
                : 'text-muted-foreground hover:text-red-500'
            )}
          >
            {isDeleting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Trash2 className="h-3.5 w-3.5" />
            }
          </Button>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-4">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {SCHEDULE_LABELS[schedule.schedule as ScheduleOption] ?? schedule.schedule}
        </span>
        <span className="flex items-center gap-1.5">
          <FormatIcon className="h-3.5 w-3.5 shrink-0" />
          {FORMAT_LABELS[schedule.format as FormatOption] ?? schedule.format}
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          Next: {formatDate(schedule.next_run_at)}
        </span>
      </div>

      {/* Recipients */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {schedule.recipients.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
          >
            <Mail className="h-2.5 w-2.5 text-muted-foreground" />
            {email}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-border-subtle pt-3 text-xs text-muted-foreground flex items-center gap-1.5">
        <Clock className="h-3 w-3 shrink-0" />
        Last sent: {formatDate(schedule.last_sent_at)}
      </div>
    </div>
  )
}

// ============================================================================
// Main component
// ============================================================================

interface SchedulesListProps {
  initialSchedules: ScheduledReportRow[]
  availableReports: SavedReport[]
}

export function SchedulesList({ initialSchedules, availableReports }: SchedulesListProps) {
  const [schedules, setSchedules] = useState(initialSchedules)
  const [showDialog, setShowDialog] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function handleToggle(id: string, enabled: boolean) {
    setTogglingId(id)
    try {
      const result = await toggleScheduledReport({ id, enabled })
      if (!('error' in result)) {
        setSchedules((prev) =>
          prev.map((s) => (s.id === id ? { ...s, enabled } : s))
        )
      }
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const result = await deleteScheduledReport(id)
      if (!('error' in result)) {
        setSchedules((prev) => prev.filter((s) => s.id !== id))
      }
    } finally {
      setDeletingId(null)
    }
  }

  function handleCreated(row: ScheduledReportRow) {
    setSchedules((prev) => [row, ...prev])
  }

  if (schedules.length === 0 && !showDialog) {
    return (
      <>
        <EmptyState onAdd={() => setShowDialog(true)} />
        <ScheduleDialog
          open={showDialog}
          onClose={() => setShowDialog(false)}
          availableReports={availableReports}
          onCreated={handleCreated}
        />
      </>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <Button className="text-sm" onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Schedule Report
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onToggle={handleToggle}
              onDelete={handleDelete}
              deletingId={deletingId}
              togglingId={togglingId}
            />
          ))}
        </div>
      </div>

      <ScheduleDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        availableReports={availableReports}
        onCreated={handleCreated}
      />
    </>
  )
}
