'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { uploadFile, getSignedUrl } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
import type { OrderAttachment } from '@/types/database'

interface OrderAttachmentsProps {
  orderId: string
  tenantId: string
}

const BUCKET = 'attachments'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function OrderAttachments({ orderId, tenantId }: OrderAttachmentsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedAttachment, setSelectedAttachment] =
    useState<OrderAttachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Thumbnail URL cache (signed URLs for image previews)
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({})

  const {
    data: attachments,
    isLoading,
  } = useQuery({
    queryKey: ['order-attachments', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_attachments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })

      if (error) throw error
      const items = (data ?? []) as OrderAttachment[]

      // Fetch signed URLs for image thumbnails
      const urls: Record<string, string> = {}
      await Promise.all(
        items
          .filter((a) => isImageFile(a.file_name))
          .map(async (a) => {
            const { url } = await getSignedUrl(supabase, BUCKET, a.storage_path, 3600)
            if (url) urls[a.id] = url
          })
      )
      setThumbnailUrls(urls)

      return items
    },
    staleTime: 30_000,
  })

  const resetForm = () => {
    setSelectedFile(null)
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileSelect = (file: File | null) => {
    if (file && file.size > MAX_FILE_SIZE) {
      setUploadError('File size exceeds 10MB limit')
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

    try {
      // Upload file to Supabase Storage
      const { path, error: uploadErr } = await uploadFile(
        supabase,
        BUCKET,
        tenantId,
        orderId,
        selectedFile
      )

      if (uploadErr) {
        setUploadError(uploadErr)
        setUploading(false)
        return
      }

      // Insert database record
      const { error: insertErr } = await supabase
        .from('order_attachments')
        .insert({
          tenant_id: tenantId,
          order_id: orderId,
          file_name: selectedFile.name,
          file_type: selectedFile.type || 'application/octet-stream',
          storage_path: path,
          file_size: selectedFile.size,
        })

      if (insertErr) {
        // Clean up uploaded file on DB insert failure
        await supabase.storage.from(BUCKET).remove([path])
        setUploadError(insertErr.message)
        setUploading(false)
        return
      }

      queryClient.invalidateQueries({
        queryKey: ['order-attachments', orderId],
      })
      setUploadOpen(false)
      resetForm()
    } catch {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (attachment: OrderAttachment) => {
    const { url, error } = await getSignedUrl(
      supabase,
      BUCKET,
      attachment.storage_path
    )
    if (error || !url) return
    window.open(url, '_blank')
  }

  const handleDelete = async () => {
    if (!selectedAttachment) return

    // Delete from storage
    await supabase.storage
      .from(BUCKET)
      .remove([selectedAttachment.storage_path])

    // Delete DB record
    await supabase
      .from('order_attachments')
      .delete()
      .eq('id', selectedAttachment.id)

    queryClient.invalidateQueries({
      queryKey: ['order-attachments', orderId],
    })
    setDeleteDialogOpen(false)
    setSelectedAttachment(null)
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Paperclip className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Attachments</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Attachments</h2>
          {attachments && attachments.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {attachments.length}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </div>

      {/* Attachments grid */}
      {!attachments || attachments.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          No attachments yet. Upload rate confirmations, photos, or documents.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {attachments.map((attachment) => {
            const isImage = isImageFile(attachment.file_name)
            const thumbnailUrl = thumbnailUrls[attachment.id]

            return (
              <div
                key={attachment.id}
                className="group relative flex flex-col overflow-hidden rounded-lg border bg-gray-50"
              >
                {/* Preview area */}
                <div className="flex h-28 items-center justify-center">
                  {isImage && thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailUrl}
                      alt={attachment.file_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FileText className="h-10 w-10 text-gray-300" />
                  )}
                </div>

                {/* Info */}
                <div className="border-t p-2">
                  <p
                    className="truncate text-xs font-medium text-gray-700"
                    title={attachment.file_name}
                  >
                    {attachment.file_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(attachment.file_size)}
                  </p>
                </div>

                {/* Hover actions */}
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
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
                    className="h-8 w-8 p-0 text-red-600"
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
              <Label htmlFor="attachment-file">File (max 10MB)</Label>
              <Input
                id="attachment-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
                onChange={(e) =>
                  handleFileSelect(e.target.files?.[0] ?? null)
                }
                className="mt-1"
              />
              <p className="mt-1 text-xs text-gray-500">
                Supported: images, PDFs, documents, spreadsheets
              </p>
            </div>

            {selectedFile && (
              <div className="rounded-md bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  {isImageFile(selectedFile.name) ? (
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                  ) : (
                    <FileText className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    {selectedFile.name}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            )}

            {uploadError && (
              <p className="text-sm text-red-600">{uploadError}</p>
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
        description={`Are you sure you want to delete "${selectedAttachment?.file_name ?? ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
