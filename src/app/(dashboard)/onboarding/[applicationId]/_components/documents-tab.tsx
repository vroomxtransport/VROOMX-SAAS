'use client'

import { APPLICANT_DOCUMENT_TYPE_LABELS } from '@/types'
import type { DriverApplicationDocument } from '@/types/database'

interface Props {
  applicationId: string
  documents: unknown[]
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ScanBadge({ status }: { status: string }) {
  if (status === 'clean') {
    return (
      <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
        Clean
      </span>
    )
  }
  if (status === 'flagged') {
    return (
      <span className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
        Flagged
      </span>
    )
  }
  return (
    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
      Pending scan
    </span>
  )
}

export function DocumentsTab({ applicationId: _applicationId, documents }: Props) {
  const typedDocs = documents as DriverApplicationDocument[]

  if (typedDocs.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border bg-surface/50">
        <p className="text-sm text-muted-foreground">No documents uploaded by the applicant.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_120px_100px_100px_80px] gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
        <span className="text-xs font-medium text-muted-foreground">File</span>
        <span className="text-xs font-medium text-muted-foreground">Type</span>
        <span className="text-xs font-medium text-muted-foreground">Size</span>
        <span className="text-xs font-medium text-muted-foreground">Uploaded</span>
        <span className="text-xs font-medium text-muted-foreground">Scan</span>
      </div>

      {typedDocs.map((doc) => (
        <div
          key={doc.id}
          className="grid grid-cols-[1fr_120px_100px_100px_80px] gap-2 items-center border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/20 transition-colors"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{doc.file_name}</p>
            {doc.mime_type && (
              <p className="text-xs text-muted-foreground font-mono">{doc.mime_type}</p>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {APPLICANT_DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {formatBytes(doc.file_size)}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(doc.uploaded_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
          <div>
            <ScanBadge status={doc.scan_status} />
          </div>
        </div>
      ))}
    </div>
  )
}
