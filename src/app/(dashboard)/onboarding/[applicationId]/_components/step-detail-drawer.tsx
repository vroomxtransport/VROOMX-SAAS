'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/shared/status-badge'
import { toast } from 'sonner'
import {
  updateStepStatus,
  waiveStep,
  uploadStepDocument,
  getStepDocuments,
  downloadStepDocument,
} from '@/app/actions/driver-onboarding'
import {
  ONBOARDING_STEP_KEY_LABELS,
  ONBOARDING_STEP_KEY_REG_CITES,
  COMPLIANCE_SUB_CATEGORY_LABELS,
} from '@/types'
import type { DriverOnboardingStep } from '@/types/database'
import type { DqfSubCategory } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: DriverOnboardingStep | null
  applicationId: string
}

const STEP_DEFAULT_SUB: Record<string, string> = {
  application_review: 'employment_application',
  mvr_pull: 'mvr',
  prior_employer_verification: 'employer_verification',
  clearinghouse_query: 'drug_alcohol_testing',
  drug_test: 'drug_alcohol_testing',
  medical_verification: 'medical_certificate',
  road_test: 'road_test_cert',
  psp_query: 'mvr',
  dq_file_assembly: 'employment_application',
  final_approval: 'employment_application',
}

const DQF_SUB_OPTIONS: { value: string; label: string }[] = [
  { value: 'cdl_endorsements', label: 'CDL & Endorsements' },
  { value: 'medical_certificate', label: 'Medical Certificate (DOT Physical)' },
  { value: 'mvr', label: 'Motor Vehicle Record (MVR)' },
  { value: 'drug_alcohol_testing', label: 'Drug & Alcohol Testing' },
  { value: 'road_test_cert', label: 'Road Test Certificate' },
  { value: 'employment_application', label: 'Employment Application' },
  { value: 'employer_verification', label: 'Previous Employer Verification' },
  { value: 'annual_review', label: 'Annual Review of Driving Record' },
  { value: 'violations_incidents', label: 'Violations & Incidents' },
]

interface StepDoc {
  id: string
  file_name: string
  sub_category: string
  file_size: number | null
  created_at: string
  storage_path: string
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function StepDetailDrawer({ open, onOpenChange, step, applicationId }: Props) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [waiveReason, setWaiveReason] = useState('')

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [subCategory, setSubCategory] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // Documents state
  const [docs, setDocs] = useState<StepDoc[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)

  // Sync notes + reset upload state when step changes
  useEffect(() => {
    setNotes(step?.notes ?? '')
    setWaiveReason('')
    setSelectedFile(null)
    setSubCategory(STEP_DEFAULT_SUB[step?.step_key ?? ''] ?? '')
  }, [step])

  // Load documents for this step
  const loadDocs = useCallback(async () => {
    if (!step) return
    setLoadingDocs(true)
    const result = await getStepDocuments(step.id)
    if ('documents' in result) {
      setDocs(result.documents)
    }
    setLoadingDocs(false)
  }, [step])

  useEffect(() => {
    if (open && step) {
      loadDocs()
    }
  }, [open, step, loadDocs])

  if (!step) return null

  const label = ONBOARDING_STEP_KEY_LABELS[step.step_key] ?? step.step_key
  const regCite = ONBOARDING_STEP_KEY_REG_CITES[step.step_key] ?? ''

  async function handleTransition(newStatus: string) {
    if (!step) return
    setBusy(true)
    try {
      const result = await updateStepStatus(step.id, newStatus, notes || undefined)
      if ('error' in result) {
        toast.error('Failed', { description: result.error })
      } else {
        queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
        toast.success(`Step marked ${newStatus}`)
        onOpenChange(false)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveNotes() {
    if (!step) return
    setBusy(true)
    try {
      const result = await updateStepStatus(step.id, step.status, notes || undefined)
      if ('error' in result) {
        toast.error('Failed', { description: result.error })
      } else {
        queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
        toast.success('Notes saved')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleWaive() {
    if (!step) return
    if (!waiveReason.trim()) {
      toast.error('Waive reason required')
      return
    }
    setBusy(true)
    try {
      const result = await waiveStep(step.id, waiveReason)
      if ('error' in result) {
        toast.error('Failed', { description: result.error })
      } else {
        queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
        toast.success('Step waived')
        onOpenChange(false)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload() {
    if (!step || !selectedFile) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.set('stepId', step.id)
      fd.set('file', selectedFile)
      if (subCategory) fd.set('subCategory', subCategory)

      const result = await uploadStepDocument(fd)
      if ('error' in result) {
        toast.error('Upload failed', { description: result.error })
      } else {
        toast.success('Document uploaded')
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        await loadDocs()
        queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(docId: string) {
    const result = await downloadStepDocument(docId)
    if ('error' in result) {
      toast.error('Download failed', { description: result.error })
    } else {
      window.open(result.url, '_blank')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }

  const isTerminal = ['passed', 'failed', 'waived', 'not_applicable'].includes(step.status)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">{label}</SheetTitle>
          {regCite && (
            <p className="text-xs font-mono text-muted-foreground">{regCite}</p>
          )}
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-6">
          {/* Current status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Current status:</span>
            <StatusBadge type="onboarding_step" status={step.status} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            {step.started_at && (
              <div>
                <p className="font-medium text-foreground">Started</p>
                <p>{new Date(step.started_at).toLocaleDateString()}</p>
              </div>
            )}
            {step.completed_at && (
              <div>
                <p className="font-medium text-foreground">Completed</p>
                <p>{new Date(step.completed_at).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="step-notes" className="text-xs font-medium">
              Notes
            </Label>
            <Textarea
              id="step-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for this step..."
              rows={4}
              className="text-sm resize-none"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleSaveNotes}
              disabled={busy}
            >
              Save Notes
            </Button>
          </div>

          {/* Status transition buttons */}
          {!isTerminal && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Transition Status</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleTransition('in_progress')}
                  disabled={busy || step.status === 'in_progress'}
                >
                  In Progress
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-green-600 hover:bg-green-700"
                  onClick={() => handleTransition('passed')}
                  disabled={busy}
                >
                  Mark Passed
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleTransition('failed')}
                  disabled={busy}
                >
                  Mark Failed
                </Button>
              </div>
            </div>
          )}

          {/* Waive section */}
          {step.waivable && !isTerminal && (
            <div className="space-y-2 rounded-lg border border-purple-100 bg-purple-50/40 p-3">
              <p className="text-xs font-medium text-purple-800">Waive this step</p>
              <p className="text-xs text-purple-700">
                Waiving is only permitted when a legitimate FMCSA exception applies (e.g., CDL substitution under § 391.33).
              </p>
              <Textarea
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                placeholder="Provide waiver justification (required)..."
                rows={2}
                className="text-xs resize-none border-purple-200 focus:border-purple-400"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-purple-600 border-purple-200 hover:bg-purple-100"
                onClick={handleWaive}
                disabled={busy || !waiveReason.trim()}
              >
                Waive Step
              </Button>
            </div>
          )}

          {/* Waive reason display */}
          {step.status === 'waived' && step.waive_reason && (
            <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-3 text-xs">
              <p className="font-medium text-purple-800 mb-1">Waiver reason</p>
              <p className="text-purple-700">{step.waive_reason}</p>
            </div>
          )}

          {/* ─── Documents Section ─── */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-foreground">Documents</p>

            {/* Upload area */}
            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
              {/* Sub-category select */}
              <div className="space-y-1">
                <Label htmlFor="step-sub-category" className="text-xs text-muted-foreground">
                  Document type
                </Label>
                <select
                  id="step-sub-category"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {DQF_SUB_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-5 cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-[var(--brand-secondary,#fb7232)] bg-orange-50/50'
                    : 'border-border hover:border-muted-foreground/40'
                }`}
              >
                {selectedFile ? (
                  <>
                    <p className="text-xs font-medium text-foreground truncate max-w-full">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatBytes(selectedFile.size)} — Click to change
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Drop file here or click to browse
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      PDF, JPG, PNG — max 25 MB
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setSelectedFile(f)
                  }}
                />
              </div>

              {/* Upload button */}
              <Button
                size="sm"
                className="h-8 w-full text-xs"
                disabled={!selectedFile || uploading}
                onClick={handleUpload}
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
              </Button>
            </div>

            {/* Document list */}
            {loadingDocs ? (
              <p className="text-xs text-muted-foreground text-center py-2">Loading documents...</p>
            ) : docs.length > 0 ? (
              <div className="space-y-1.5">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(COMPLIANCE_SUB_CATEGORY_LABELS as Record<string, string>)[doc.sub_category] ?? doc.sub_category}
                        {' · '}
                        {formatBytes(doc.file_size)}
                        {' · '}
                        {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => handleDownload(doc.id)}
                    >
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-1">
                No documents uploaded for this step yet.
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
