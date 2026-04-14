'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadApplicationDocument } from '@/app/actions/driver-applications'

// Narrow allowlist for public applicant uploads (no Office formats)
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic'])
const ALLOWED_MIME_PREFIXES = ['application/pdf', 'image/']
const MAX_BYTES = 25 * 1024 * 1024 // 25 MB
const ACCEPTED_ATTR = '.pdf,.jpg,.jpeg,.png,.heic'

export type DocumentType = 'license_front' | 'license_back' | 'medical_card' | 'other'

interface FileUploadFieldProps {
  label: string
  documentType: DocumentType
  resumeToken: string
  onUploadSuccess?: (metadata: {
    documentId: string
    storagePath: string
    fileName: string
  }) => void
  /** If the document was already uploaded (pre-fill from draft) */
  existingFilePath?: string | null
  required?: boolean
  error?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Single-file upload component for applicant documents.
 *
 * Reuses the drag-drop pattern from bulk-upload-dialog.tsx but scoped to:
 * - A single file
 * - Narrow allowlist: pdf, jpg, jpeg, png, heic only
 * - Server-side upload via uploadApplicationDocument() server action
 *   (magic-byte validation, extension allowlist, rate limiting all happen server-side)
 * - Client-side pre-validation for immediate UX feedback only — NOT a security boundary
 */
export function FileUploadField({
  label,
  documentType,
  resumeToken,
  onUploadSuccess,
  existingFilePath,
  required = false,
  error,
}: FileUploadFieldProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isAlreadyUploaded = !!existingFilePath

  // Derive a display name from the storage path for resumed uploads
  const existingFileName = existingFilePath
    ? (existingFilePath.split('/').pop() ?? 'Previously uploaded file')
    : null

  async function handleFile(file: File) {
    setUploadError(null)

    // Client-side pre-validation — UX only, server re-validates everything
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      setUploadError(`File type .${ext} is not allowed. Use PDF, JPG, PNG, or HEIC.`)
      setUploadState('error')
      return
    }

    if (file.type && !ALLOWED_MIME_PREFIXES.some((p) => file.type.startsWith(p))) {
      setUploadError(`File type ${file.type} is not allowed.`)
      setUploadState('error')
      return
    }

    if (file.size > MAX_BYTES) {
      setUploadError(`File is too large (${formatBytes(file.size)}). Maximum is 25 MB.`)
      setUploadState('error')
      return
    }

    setUploadState('uploading')
    setUploadedFileName(file.name)

    const formData = new FormData()
    formData.append('resumeToken', resumeToken)
    formData.append('documentType', documentType)
    formData.append('file', file)

    const result = await uploadApplicationDocument(formData)

    if ('error' in result) {
      setUploadError(result.error)
      setUploadState('error')
      return
    }

    // Success: server has uploaded the file and inserted the metadata row
    setUploadState('success')
    onUploadSuccess?.({ documentId: result.documentId, storagePath: result.storagePath, fileName: file.name })
  }

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) void handleFile(file)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resumeToken, documentType],
  )

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setIsDragging(false), [])

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void handleFile(file)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resumeToken, documentType],
  )

  const displayError = error ?? uploadError
  const isSuccess = uploadState === 'success' || isAlreadyUploaded
  const isUploading = uploadState === 'uploading'
  const isError = !isSuccess && !!displayError

  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
      </label>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={cn(
          // Base — geometry, cursor, focus ring, transition
          'relative flex min-h-[100px] min-w-[44px] cursor-pointer flex-col items-center justify-center',
          'gap-2 overflow-hidden rounded-xl border-2 border-dashed px-4 py-5',
          'transition-all duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] focus-visible:ring-offset-2',
          // State-based appearance
          isDragging
            ? 'border-[var(--brand-primary,#192334)] bg-orange-50/30 shadow-[0_0_0_4px_rgba(251,114,50,0.08)]'
            : isSuccess
              ? 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300'
              : isError
                ? 'border-red-200 bg-red-50/50 hover:border-red-300'
                : 'border-gray-200 bg-gradient-to-b from-gray-50/50 to-white hover:border-gray-300 hover:bg-gray-50/80',
        )}
      >
        {/* Content */}
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <Loader2
                className="h-5 w-5 animate-spin text-[var(--brand-primary,#192334)]"
                aria-hidden="true"
              />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Uploading…</span>
          </div>
        ) : isSuccess ? (
          <div className="flex flex-col items-center gap-1.5">
            {/* Green check badge */}
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            </div>
            <span className="max-w-[200px] truncate text-sm font-medium text-gray-700">
              {uploadedFileName ?? existingFileName ?? 'File uploaded'}
            </span>
            <span className="text-xs text-muted-foreground">Click to replace</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <X className="h-5 w-5 text-red-500" aria-hidden="true" />
            </div>
            <span className="text-sm font-medium text-gray-600">
              Drag &amp; drop or{' '}
              <span className="font-semibold text-[var(--brand-primary,#192334)]">click to upload</span>
            </span>
            <span className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, HEIC · max 25 MB</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <span className="text-sm font-medium text-gray-600">
              Drag &amp; drop or{' '}
              <span className="font-semibold text-[var(--brand-primary,#192334)]">click to upload</span>
            </span>
            <span className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, HEIC · max 25 MB</span>
          </div>
        )}

        {/* Uploading progress bar — thin brand-colored stripe that animates across the bottom */}
        {isUploading && (
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-0.5 w-full overflow-hidden rounded-b-xl bg-gray-100"
          >
            <span
              className="absolute inset-y-0 left-0 h-full animate-[progress-indeterminate_1.4s_ease-in-out_infinite] bg-[var(--brand-primary,#192334)]"
              style={{
                // CSS custom keyframe — falls back gracefully if not present
                animationName: 'progress-indeterminate',
              }}
            />
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_ATTR}
        onChange={onInputChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        style={{ fontSize: '16px' }}
      />

      {/* Error message */}
      {displayError && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {displayError}
        </p>
      )}
    </div>
  )
}
