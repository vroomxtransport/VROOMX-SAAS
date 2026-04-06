'use client'

import { useState, useRef, useCallback } from 'react'
import {
  ChevronRight,
  Folder,
  FileText,
  Upload,
  Trash2,
  Loader2,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateComplianceDocFields, deleteComplianceDoc } from '@/app/actions/compliance'
import { getSignedUrl } from '@/lib/storage'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { ComplianceFolder } from '@/lib/queries/compliance-folders'
import type { ComplianceDocument } from '@/types/database'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function statusDotColor(status: string): string {
  switch (status) {
    case 'expired':
      return 'bg-red-500'
    case 'expiring_soon':
      return 'bg-amber-500'
    case 'valid':
      return 'bg-emerald-500'
    default:
      return 'bg-muted-foreground/30'
  }
}

function formatDisplayDate(isoString: string | null): string {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

/** Convert ISO string / date string → input[type=date] value (YYYY-MM-DD) */
function toInputDate(isoString: string | null): string {
  if (!isoString) return ''
  // Already YYYY-MM-DD?
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) return isoString
  try {
    const d = new Date(isoString)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

async function openSignedUrl(storagePath: string): Promise<void> {
  const supabase = createClient()
  const { url, error } = await getSignedUrl(supabase, 'documents', storagePath, 3600)
  if (url && !error) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FolderRowProps {
  folder: ComplianceFolder
  onUploadNewVersion: () => void
  onDeleteFolder?: () => void
}

// ─── Version list (expanded sub-table) ───────────────────────────────────────

interface VersionListProps {
  documents: ComplianceDocument[]
  onDelete: (id: string) => void
  isDeleting: boolean
  deletingId: string | null
}

function VersionList({ documents, onDelete, isDeleting, deletingId }: VersionListProps) {
  if (documents.length === 0) return null

  return (
    <tr className="bg-muted/10">
      <td colSpan={6} className="px-0 pb-0 pt-0">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/20">
              <th className="pl-12 pr-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                File
              </th>
              <th className="px-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Version
              </th>
              <th className="px-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide tabular-nums">
                Size
              </th>
              <th className="px-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide tabular-nums">
                Uploaded
              </th>
              <th className="px-3 py-1.5 w-[60px]" />
            </tr>
          </thead>
          <tbody>
            {documents.map((doc, index) => {
              const versionNumber = documents.length - index
              const isActive = index === 0
              const isBeingDeleted = isDeleting && deletingId === doc.id

              return (
                <tr
                  key={doc.id}
                  className={cn(
                    'border-t border-border/40 transition-colors',
                    isActive ? 'bg-muted/5' : 'bg-muted/20'
                  )}
                >
                  {/* File name */}
                  <td className="pl-12 pr-3 py-2">
                    <button
                      type="button"
                      className={cn(
                        'flex items-center gap-2 text-xs transition-colors',
                        doc.storage_path
                          ? 'text-brand hover:text-brand/80 underline-offset-2 hover:underline cursor-pointer'
                          : 'text-muted-foreground cursor-default'
                      )}
                      onClick={() => {
                        if (doc.storage_path) {
                          void openSignedUrl(doc.storage_path)
                        }
                      }}
                      disabled={!doc.storage_path}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate max-w-[200px]">
                        {doc.file_name ?? doc.name}
                      </span>
                    </button>
                  </td>

                  {/* Version badge */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        v{versionNumber}
                      </span>
                      {isActive && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                          active
                        </span>
                      )}
                    </div>
                  </td>

                  {/* File size */}
                  <td className="px-3 py-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatFileSize(doc.file_size)}
                    </span>
                  </td>

                  {/* Upload date */}
                  <td className="px-3 py-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDisplayDate(doc.created_at)}
                    </span>
                  </td>

                  {/* Delete */}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      aria-label="Delete version"
                      disabled={isBeingDeleted}
                      onClick={() => onDelete(doc.id)}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                    >
                      {isBeingDeleted ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </td>
    </tr>
  )
}

// ─── Inline date input ────────────────────────────────────────────────────────

interface InlineDateInputProps {
  value: string
  onBlurSave: (value: string) => void
  disabled?: boolean
}

function InlineDateInput({ value, onBlurSave, disabled }: InlineDateInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const isDirtyRef = useRef(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
    isDirtyRef.current = true
  }

  const handleBlur = () => {
    if (isDirtyRef.current) {
      isDirtyRef.current = false
      onBlurSave(localValue)
    }
  }

  return (
    <input
      type="date"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      className={cn(
        'w-full bg-transparent text-xs text-foreground tabular-nums',
        'border border-transparent rounded px-1 py-0.5',
        'focus:border-brand/40 focus:outline-none focus:ring-0',
        'hover:border-border-subtle transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
    />
  )
}

// ─── Inline notes input ───────────────────────────────────────────────────────

interface InlineNotesInputProps {
  value: string
  onBlurSave: (value: string) => void
  disabled?: boolean
}

function InlineNotesInput({ value, onBlurSave, disabled }: InlineNotesInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const isDirtyRef = useRef(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
    isDirtyRef.current = true
  }

  const handleBlur = () => {
    if (isDirtyRef.current) {
      isDirtyRef.current = false
      onBlurSave(localValue)
    }
  }

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder="Add notes..."
      className={cn(
        'w-full bg-transparent text-xs text-foreground',
        'border border-transparent rounded px-1 py-0.5',
        'focus:border-brand/40 focus:outline-none focus:ring-0',
        'hover:border-border-subtle transition-colors',
        'placeholder:text-muted-foreground/50',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
    />
  )
}

// ─── Main FolderRow ───────────────────────────────────────────────────────────

export function FolderRow({ folder, onUploadNewVersion, onDeleteFolder }: FolderRowProps) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { activeDocument, status, label, documents, isCustom } = folder

  // ── Mutation: update fields inline ──
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      fields,
    }: {
      id: string
      fields: { issueDate?: string | null; expiresAt?: string | null; notes?: string | null }
    }) => updateComplianceDocFields(id, fields),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compliance-folders'] })
      void queryClient.invalidateQueries({ queryKey: ['compliance-expiration-alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['compliance-docs'] })
    },
  })

  // ── Mutation: delete a document version ──
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteComplianceDoc(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compliance-folders'] })
      void queryClient.invalidateQueries({ queryKey: ['compliance-expiration-alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['compliance-docs'] })
      setDeletingId(null)
    },
    onError: () => {
      setDeletingId(null)
    },
  })

  const handleDelete = useCallback(
    (id: string) => {
      setDeletingId(id)
      deleteMutation.mutate(id)
    },
    [deleteMutation]
  )

  const handleIssueDateSave = useCallback(
    (value: string) => {
      if (!activeDocument) return
      updateMutation.mutate({
        id: activeDocument.id,
        fields: { issueDate: value || null },
      })
    },
    [activeDocument, updateMutation]
  )

  const handleExpDateSave = useCallback(
    (value: string) => {
      if (!activeDocument) return
      updateMutation.mutate({
        id: activeDocument.id,
        fields: { expiresAt: value || null },
      })
    },
    [activeDocument, updateMutation]
  )

  const handleNotesSave = useCallback(
    (value: string) => {
      if (!activeDocument) return
      updateMutation.mutate({
        id: activeDocument.id,
        fields: { notes: value || null },
      })
    },
    [activeDocument, updateMutation]
  )

  const isSaving = updateMutation.isPending

  return (
    <>
      <tr
        className={cn(
          'group border-b border-border-subtle transition-colors',
          'hover:bg-muted/30'
        )}
      >
        {/* ── Col 1: Chevron + Folder icon + label + file name ── */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-2">
            {/* Chevron — shows saving spinner when mutating */}
            <button
              type="button"
              aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
              onClick={() => setExpanded((prev) => !prev)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
              ) : (
                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 transition-transform duration-150',
                    expanded && 'rotate-90'
                  )}
                />
              )}
            </button>

            {/* Folder icon */}
            <Folder
              className={cn(
                'h-4 w-4 shrink-0',
                status === 'missing' ? 'text-blue-400' : 'text-blue-500'
              )}
            />

            {/* Label + file name */}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground leading-none">
                {label}
              </div>
              {activeDocument?.file_name && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeDocument.storage_path) {
                      void openSignedUrl(activeDocument.storage_path)
                    }
                  }}
                  className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-brand hover:underline underline-offset-2 transition-colors"
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[160px]">{activeDocument.file_name}</span>
                </button>
              )}
              {!activeDocument && (
                <button
                  type="button"
                  onClick={onUploadNewVersion}
                  className="mt-0.5 text-xs text-muted-foreground/60 underline underline-offset-2 hover:text-brand transition-colors"
                >
                  No document
                </button>
              )}
            </div>
          </div>
        </td>

        {/* ── Col 2: Issue Date ── */}
        <td className="py-3 px-3">
          {activeDocument ? (
            <InlineDateInput
              value={toInputDate(activeDocument.issue_date)}
              onBlurSave={handleIssueDateSave}
              disabled={isSaving}
            />
          ) : (
            <span className="text-xs text-muted-foreground/30">—</span>
          )}
        </td>

        {/* ── Col 3: Exp. Date ── */}
        <td className="py-3 px-3">
          {activeDocument ? (
            <InlineDateInput
              value={toInputDate(activeDocument.expires_at)}
              onBlurSave={handleExpDateSave}
              disabled={isSaving}
            />
          ) : (
            <span className="text-xs text-muted-foreground/30">—</span>
          )}
        </td>

        {/* ── Col 4: Uploaded Date (read-only) ── */}
        <td className="py-3 px-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {activeDocument ? formatDisplayDate(activeDocument.created_at) : '—'}
          </span>
        </td>

        {/* ── Col 5: Notes ── */}
        <td className="py-3 px-3">
          {activeDocument ? (
            <InlineNotesInput
              value={activeDocument.notes ?? ''}
              onBlurSave={handleNotesSave}
              disabled={isSaving}
            />
          ) : (
            <span className="text-xs text-muted-foreground/30" />
          )}
        </td>

        {/* ── Col 6: Actions (hover-revealed) ── */}
        <td className="py-3 px-3">
          <div className="flex items-center justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            {/* Status dot for expired / expiring */}
            {activeDocument && status !== 'valid' && status !== 'missing' && (
              <span
                title={status === 'expired' ? 'Expired' : 'Expiring soon'}
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  statusDotColor(status)
                )}
              />
            )}

            {/* Upload new version */}
            <button
              type="button"
              aria-label="Upload new version"
              onClick={onUploadNewVersion}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand"
            >
              <Upload className="h-3.5 w-3.5" />
            </button>

            {/* Delete folder — only for custom folders */}
            {isCustom && onDeleteFolder && (
              <button
                type="button"
                aria-label="Delete folder"
                onClick={onDeleteFolder}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* ── Expanded version list ── */}
      {expanded && documents.length > 0 && (
        <VersionList
          documents={documents}
          onDelete={handleDelete}
          isDeleting={deleteMutation.isPending}
          deletingId={deletingId}
        />
      )}

      {/* Empty expand state */}
      {expanded && documents.length === 0 && (
        <tr className="bg-muted/10">
          <td colSpan={6} className="pl-12 py-3 text-xs text-muted-foreground italic">
            No documents uploaded yet.
          </td>
        </tr>
      )}
    </>
  )
}
