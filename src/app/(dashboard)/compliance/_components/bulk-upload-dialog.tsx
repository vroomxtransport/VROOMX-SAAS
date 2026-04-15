'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, X, Loader2, Check, FileText, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DQF_SUB_CATEGORIES,
  VEHICLE_SUB_CATEGORIES,
  COMPANY_SUB_CATEGORIES,
  COMPLIANCE_SUB_CATEGORY_LABELS,
} from '@/types'
import { uploadFile } from '@/lib/storage'
import { createComplianceDoc } from '@/app/actions/compliance'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentType: 'dqf' | 'vehicle_qualification' | 'company_document'
  entityType: 'driver' | 'truck' | 'company'
  entityId: string | null
  onSuccess: () => void
}

type FileStatus = 'pending' | 'uploading' | 'success' | 'error'

interface PendingFile {
  file: File
  subCategory: string
  issueDate: string
  expiresAt: string
  status: FileStatus
  error?: string
}

// ─── Sub-category catalog ─────────────────────────────────────────────────────

const SUB_CATEGORIES_BY_DOC_TYPE: Record<string, readonly string[]> = {
  dqf: DQF_SUB_CATEGORIES,
  vehicle_qualification: VEHICLE_SUB_CATEGORIES,
  company_document: COMPANY_SUB_CATEGORIES,
}

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx'
const MAX_BYTES = 25 * 1024 * 1024

// ─── Smart fuzzy matcher ──────────────────────────────────────────────────────

function matchSubCategory(fileName: string, subCategories: readonly string[]): string {
  if (subCategories.length === 0) return ''
  const normalized = fileName
    .toLowerCase()
    .replace(/[_\-.]/g, ' ')
    .replace(/\.[^.]+$/, '')
  const words = normalized.split(/\s+/).filter(Boolean)

  let bestMatch: string | null = null
  let bestScore = 0

  for (const cat of subCategories) {
    const catLabel = (COMPLIANCE_SUB_CATEGORY_LABELS as Record<string, string>)[cat] ?? cat
    const catWords = catLabel
      .toLowerCase()
      .replace(/[()&\-/]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)

    let score = 0
    for (const word of catWords) {
      if (word.length < 3) continue
      if (words.some((w) => w.includes(word) || word.includes(w))) score++
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = cat
    }
  }

  return bestMatch ?? subCategories[0]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BulkUploadDialog({
  open,
  onOpenChange,
  documentType,
  entityType,
  entityId,
  onSuccess,
}: BulkUploadDialogProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const addMoreInputRef = useRef<HTMLInputElement>(null)

  const subCategories = SUB_CATEGORIES_BY_DOC_TYPE[documentType] ?? []

  // ── Reset on close ──────────────────────────────────────────────────────────
  const handleOpenChange = (next: boolean) => {
    if (!next && !uploading) {
      setPendingFiles([])
      setGlobalError(null)
      setUploadProgress(null)
      setIsDragging(false)
    }
    onOpenChange(next)
  }

  // ── File ingestion ──────────────────────────────────────────────────────────
  const ingestFiles = useCallback(
    (rawFiles: File[]) => {
      const valid = rawFiles.filter((f) => f.size <= MAX_BYTES)
      const oversized = rawFiles.length - valid.length
      if (oversized > 0) {
        setGlobalError(`${oversized} file${oversized > 1 ? 's were' : ' was'} skipped — files must be under 25 MB.`)
      } else {
        setGlobalError(null)
      }

      const newEntries: PendingFile[] = valid.map((f) => ({
        file: f,
        subCategory: matchSubCategory(f.name, subCategories),
        issueDate: '',
        expiresAt: '',
        status: 'pending',
      }))

      setPendingFiles((prev) => [...prev, ...newEntries])
    },
    [subCategories],
  )

  // ── Drag handlers ───────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    ingestFiles(Array.from(e.dataTransfer.files))
  }

  // ── Input change ────────────────────────────────────────────────────────────
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      ingestFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }

  // ── Per-file field updates ──────────────────────────────────────────────────
  const updateFile = (index: number, patch: Partial<PendingFile>) => {
    setPendingFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    )
  }

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const setFileStatus = (index: number, status: FileStatus, error?: string) => {
    setPendingFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status, error } : f)),
    )
  }

  // ── Upload all ──────────────────────────────────────────────────────────────
  const uploadAll = async () => {
    setUploading(true)
    setGlobalError(null)
    setUploadProgress({ done: 0, total: pendingFiles.length })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const tenantId = user?.app_metadata?.tenant_id as string | undefined

    if (!tenantId) {
      setGlobalError('Authentication required. Please refresh and try again.')
      setUploading(false)
      setUploadProgress(null)
      return
    }

    let succeeded = 0
    let failed = 0

    for (let i = 0; i < pendingFiles.length; i++) {
      const entry = pendingFiles[i]
      if (entry.status === 'success') {
        succeeded++
        continue
      }

      setFileStatus(i, 'uploading')

      try {
        const uploadEntityId = entityId ?? 'company'
        const { path, error: uploadErr } = await uploadFile(
          supabase,
          'documents',
          tenantId,
          uploadEntityId,
          entry.file,
        )

        if (uploadErr || !path) {
          setFileStatus(i, 'error', uploadErr ?? 'Upload failed')
          failed++
          setUploadProgress((prev) => prev ? { ...prev, done: prev.done + 1 } : null)
          continue
        }

        const result = await createComplianceDoc({
          documentType,
          entityType,
          entityId: entityId ?? '',
          name: entry.file.name,
          subCategory: entry.subCategory,
          issueDate: entry.issueDate || undefined,
          expiresAt: entry.expiresAt || undefined,
          fileName: entry.file.name,
          storagePath: path,
          fileSize: entry.file.size,
        })

        if ('error' in result && result.error) {
          setFileStatus(i, 'error', typeof result.error === 'string' ? result.error : 'Failed to save document record')
          failed++
        } else {
          setFileStatus(i, 'success')
          succeeded++
        }
      } catch (err) {
        setFileStatus(i, 'error', err instanceof Error ? err.message : 'Unexpected error')
        failed++
      }

      setUploadProgress((prev) => prev ? { ...prev, done: prev.done + 1 } : null)
    }

    setUploading(false)

    if (failed === 0) {
      onSuccess()
      handleOpenChange(false)
    } else {
      setGlobalError(
        `${failed} file${failed > 1 ? 's' : ''} failed to upload. Review the errors below and try again.`,
      )
      setUploadProgress(null)
    }
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const hasPendingFiles = pendingFiles.length > 0
  const canUpload = pendingFiles.some((f) => f.status === 'pending' || f.status === 'error') && !uploading
  const progressPct = uploadProgress
    ? Math.round((uploadProgress.done / uploadProgress.total) * 100)
    : 0

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-6 py-5">
          <DialogTitle className="text-base font-semibold">Bulk Upload Documents</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Drop multiple files at once. We&apos;ll auto-match each file to its category.
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        {uploading && uploadProgress && (
          <div className="relative h-1 w-full shrink-0 overflow-hidden bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-[var(--brand)] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">

          {/* Global error banner */}
          {globalError && (
            <div className="mb-4 rounded-md border px-4 py-3 text-sm text-red-700">
              {globalError}
            </div>
          )}

          {/* Drop zone — shown when no files yet */}
          {!hasPendingFiles && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop files here or click to browse"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
              }}
              className={cn(
                'flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors duration-150',
                isDragging
                  ? 'border-[var(--brand)] bg-[var(--brand)]/5 text-[var(--brand)]'
                  : 'border-border text-muted-foreground hover:border-[var(--brand)]/60 hover:bg-muted/40',
              )}
            >
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
                  isDragging ? 'bg-[var(--brand)]/10' : 'bg-muted',
                )}
              >
                <Upload className="h-5 w-5" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Drag files here or click to browse</p>
                <p className="mt-0.5 text-xs opacity-70">
                  PDF, images, Word, Excel — max 25 MB per file
                </p>
              </div>
            </div>
          )}

          {/* File list */}
          {hasPendingFiles && (
            <div className="space-y-2">
              {pendingFiles.map((entry, index) => (
                <FileRow
                  key={`${entry.file.name}-${index}`}
                  entry={entry}
                  index={index}
                  subCategories={subCategories}
                  uploading={uploading}
                  onUpdate={updateFile}
                  onRemove={removeFile}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Add more files button */}
            {hasPendingFiles && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => addMoreInputRef.current?.click()}
                className="gap-1.5 text-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Add more files
              </Button>
            )}

            <div className="flex flex-1 items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={() => handleOpenChange(false)}
                className="text-sm"
              >
                Cancel
              </Button>

              {!hasPendingFiles ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Browse files
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!canUpload}
                  onClick={uploadAll}
                  className="min-w-[100px] gap-1.5 bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90 disabled:opacity-40"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      Upload All ({pendingFiles.filter((f) => f.status !== 'success').length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          className="sr-only"
          onChange={handleFileInputChange}
        />
        <input
          ref={addMoreInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          className="sr-only"
          onChange={handleFileInputChange}
        />
      </DialogContent>
    </Dialog>
  )
}

// ─── File row sub-component ───────────────────────────────────────────────────

interface FileRowProps {
  entry: PendingFile
  index: number
  subCategories: readonly string[]
  uploading: boolean
  onUpdate: (index: number, patch: Partial<PendingFile>) => void
  onRemove: (index: number) => void
}

function FileRow({ entry, index, subCategories, uploading, onUpdate, onRemove }: FileRowProps) {
  const isLocked = entry.status === 'uploading' || entry.status === 'success'

  return (
    <div
      className={cn(
        'group rounded-lg border bg-card transition-colors',
        entry.status === 'success' && 'border-emerald-200 bg-emerald-50/50',
        entry.status === 'error' && 'border-red-200 bg-red-50/40',
        entry.status === 'uploading' && 'border-[var(--brand)]/30 bg-[var(--brand)]/5',
        entry.status === 'pending' && 'hover:border-border/80',
      )}
    >
      {/* Top row: icon + name + size + status + remove */}
      <div className="flex items-center gap-3 px-3.5 pt-3">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            entry.status === 'success' ? 'text-emerald-600' :
            entry.status === 'error' ? 'text-red-500' :
            entry.status === 'uploading' ? 'bg-[var(--brand)]/10 text-[var(--brand)]' :
            'bg-muted text-muted-foreground',
          )}
        >
          {entry.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin" />}
          {entry.status === 'success' && <Check className="h-4 w-4" />}
          {entry.status === 'error' && <X className="h-4 w-4" />}
          {entry.status === 'pending' && <FileText className="h-4 w-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium leading-tight text-foreground"
            title={entry.file.name}
          >
            {entry.file.name}
          </p>
          <p className="text-xs text-muted-foreground">{formatBytes(entry.file.size)}</p>
        </div>

        {!uploading && entry.status !== 'success' && (
          <button
            type="button"
            aria-label={`Remove ${entry.file.name}`}
            onClick={() => onRemove(index)}
            className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Error message */}
      {entry.status === 'error' && entry.error && (
        <p className="px-3.5 pb-1 pt-1 text-xs text-red-600">{entry.error}</p>
      )}

      {/* Bottom row: fields — hidden when locked */}
      {!isLocked && (
        <div className="grid grid-cols-3 gap-2 px-3.5 pb-3 pt-2">
          {/* Folder / sub-category */}
          <div className="col-span-3 sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Category
            </label>
            <Select
              value={entry.subCategory}
              onValueChange={(val) => onUpdate(index, { subCategory: val })}
              disabled={isLocked}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {subCategories.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-xs">
                    {(COMPLIANCE_SUB_CATEGORY_LABELS as Record<string, string>)[cat] ?? cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Issue date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Issue date
            </label>
            <input
              type="date"
              value={entry.issueDate}
              disabled={isLocked}
              onChange={(e) => onUpdate(index, { issueDate: e.target.value })}
              className={cn(
                'h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-sm transition-colors',
                'focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-0',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
          </div>

          {/* Expiration date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Expiration
            </label>
            <input
              type="date"
              value={entry.expiresAt}
              disabled={isLocked}
              onChange={(e) => onUpdate(index, { expiresAt: e.target.value })}
              className={cn(
                'h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-sm transition-colors',
                'focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-0',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
          </div>
        </div>
      )}
    </div>
  )
}
