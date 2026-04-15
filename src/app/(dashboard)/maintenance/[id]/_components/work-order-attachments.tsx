'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getSignedUrl } from '@/lib/storage'
import { uploadWorkOrderAttachment, deleteWorkOrderAttachment } from '@/app/actions/work-order-attachments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
} from 'lucide-react'
import type { WorkOrderAttachment } from '@/types/database'

interface WorkOrderAttachmentsProps {
  workOrderId: string
  attachments: WorkOrderAttachment[]
}

const BUCKET = 'attachments'
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB — matches storage.ts

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

function isImageFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.has(ext)
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function WorkOrderAttachments({
  workOrderId,
  attachments,
}: WorkOrderAttachmentsProps) {
  const supabase = createClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedAttachment, setSelectedAttachment] =
    useState<WorkOrderAttachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Signed URL cache for image thumbnails (fetched lazily on open)
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({})

  // Load thumbnails for image attachments
  const loadThumbnails = async (items: WorkOrderAttachment[]) => {
    const urls: Record<string, string> = { ...thumbnailUrls }
    await Promise.all(
      items
        .filter((a) => isImageFile(a.file_name) && !urls[a.id])
        .map(async (a) => {
          const { url } = await getSignedUrl(supabase, BUCKET, a.storage_path, 3600)
          if (url) urls[a.id] = url
        }),
    )
    setThumbnailUrls(urls)
  }

  // Load thumbnails on mount for any existing image attachments
  useEffect(() => {
    if (attachments.some((a) => isImageFile(a.file_name))) {
      void loadThumbnails(attachments)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments])

  const resetForm = () => {
    setSelectedFile(null)
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileSelect = (file: File | null) => {
    if (file && file.size > MAX_FILE_SIZE) {
      setUploadError('File size exceeds 25 MB limit')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setUploadError(null)
    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file')
      return
    }

    setUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('workOrderId', workOrderId)
    formData.append('file', selectedFile)

    const result = await uploadWorkOrderAttachment(formData)

    if ('error' in result && result.error) {
      setUploadError(
        typeof result.error === 'string' ? result.error : 'Upload failed.',
      )
      setUploading(false)
      return
    }

    toast.success('Attachment uploaded')
    setUploadOpen(false)
    resetForm()
    setUploading(false)
    router.refresh()
  }

  const handleDownload = async (attachment: WorkOrderAttachment) => {
    const { url, error } = await getSignedUrl(
      supabase,
      BUCKET,
      attachment.storage_path,
    )
    if (error || !url) {
      toast.error('Could not generate download link')
      return
    }
    window.open(url, '_blank')
  }

  const handleDelete = async () => {
    if (!selectedAttachment) return

    const result = await deleteWorkOrderAttachment(selectedAttachment.id)

    if ('error' in result && result.error) {
      toast.error(
        typeof result.error === 'string'
          ? result.error
          : 'Failed to delete attachment',
      )
      return
    }

    toast.success('Attachment deleted')
    setDeleteDialogOpen(false)
    setSelectedAttachment(null)
    router.refresh()
  }

  return (
    <div className="widget-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Attachments</h2>
          {attachments.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
              {attachments.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={() => setUploadOpen(true)}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </Button>
      </div>

      {/* Content */}
      <div className="p-4">
        {attachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <div className="rounded-xl bg-muted p-3">
              <Paperclip className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No attachments yet</p>
            <p className="max-w-[220px] text-xs text-muted-foreground">
              Upload photos, invoices, or documents related to this work order.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {attachments.map((attachment) => {
              const isImage = isImageFile(attachment.file_name)
              const thumbnailUrl = thumbnailUrls[attachment.id]

              return (
                <div
                  key={attachment.id}
                  className="group relative flex flex-col overflow-hidden rounded-lg border bg-muted/50"
                >
                  {/* Preview */}
                  <div className="flex h-24 items-center justify-center bg-muted/30">
                    {isImage && thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbnailUrl}
                        alt={attachment.file_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileText className="h-8 w-8 text-muted-foreground/60" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="border-t p-2">
                    <p
                      className="truncate text-xs font-medium text-foreground/80"
                      title={attachment.file_name}
                    >
                      {attachment.file_name}
                    </p>
                    <p className="tabular-nums text-xs text-muted-foreground">
                      {formatFileSize(attachment.file_size)}
                    </p>
                  </div>

                  {/* Hover actions */}
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleDownload(attachment)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => {
                        setSelectedAttachment(attachment)
                        setDeleteDialogOpen(true)
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upload dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Attachment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="wo-attachment-file">File (max 25 MB)</Label>
              <Input
                id="wo-attachment-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Supported: images, PDFs, documents, spreadsheets
              </p>
            </div>

            {selectedFile && (
              <div className="rounded-md bg-muted/50 p-3">
                <div className="flex items-center gap-2">
                  {isImageFile(selectedFile.name) ? (
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {selectedFile.name}
                  </span>
                </div>
                <p className="mt-1 tabular-nums text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            )}

            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Attachment"
        description={`Are you sure you want to delete "${selectedAttachment?.file_name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
