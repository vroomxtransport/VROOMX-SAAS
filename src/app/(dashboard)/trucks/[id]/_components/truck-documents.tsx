'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { uploadFile } from '@/lib/storage'
import { getSignedUrl } from '@/lib/storage'
import { createDocument, deleteDocument } from '@/app/actions/documents'
import { fetchDocuments } from '@/lib/queries/documents'
import type { TruckDocument } from '@/types/database'
import { TRUCK_DOCUMENT_TYPE_LABELS } from '@/types'
import type { TruckDocumentType } from '@/types'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Plus,
  Download,
  Trash2,
  Upload,
  AlertCircle,
} from 'lucide-react'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface TruckDocumentsProps {
  truckId: string
  tenantId: string
}

export function TruckDocuments({ truckId, tenantId }: TruckDocumentsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['truck-documents', truckId],
    queryFn: () => fetchDocuments(supabase, 'truck', truckId),
    staleTime: 30_000,
  })

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
  const [deleteDocName, setDeleteDocName] = useState('')
  const [isDownloading, setIsDownloading] = useState<string | null>(null)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['truck-documents', truckId] })
  }

  const handleDownload = async (doc: TruckDocument) => {
    setIsDownloading(doc.id)
    try {
      const { url, error } = await getSignedUrl(supabase, 'documents', doc.storage_path)
      if (error || !url) {
        console.error('Failed to get download URL:', error)
        return
      }
      window.open(url, '_blank')
    } finally {
      setIsDownloading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteDocId) return
    await deleteDocument('truck', deleteDocId)
    invalidate()
    setDeleteDocId(null)
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '--'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="rounded-lg border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <FileText className="h-4 w-4" />
          Documents
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setUploadDialogOpen(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Upload
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-md bg-gray-100"
            />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <p className="text-sm text-gray-400">
          No documents uploaded. Upload registration, insurance, or inspection
          certificates.
        </p>
      ) : (
        <div className="space-y-2">
          {(documents as TruckDocument[]).map((doc) => {
            const isExpired =
              doc.expires_at && new Date(doc.expires_at) < new Date()
            return (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span className="truncate text-sm font-medium text-gray-900">
                      {doc.file_name}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                    <span>
                      {
                        TRUCK_DOCUMENT_TYPE_LABELS[
                          doc.document_type as TruckDocumentType
                        ]
                      }
                    </span>
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>Uploaded {formatDate(doc.created_at)}</span>
                    {doc.expires_at && (
                      <span
                        className={
                          isExpired ? 'font-medium text-red-600' : ''
                        }
                      >
                        {isExpired ? (
                          <span className="flex items-center gap-0.5">
                            <AlertCircle className="h-3 w-3" />
                            Expired {formatDate(doc.expires_at)}
                          </span>
                        ) : (
                          `Expires ${formatDate(doc.expires_at)}`
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleDownload(doc)}
                    disabled={isDownloading === doc.id}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    onClick={() => {
                      setDeleteDocId(doc.id)
                      setDeleteDocName(doc.file_name)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <UploadDocumentDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        truckId={truckId}
        tenantId={tenantId}
        onSuccess={invalidate}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteDocId}
        onOpenChange={(open) => {
          if (!open) setDeleteDocId(null)
        }}
        title="Delete Document"
        description={`Are you sure you want to delete "${deleteDocName}"? The file will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ------------------------------------------------------------------
// UploadDocumentDialog: file upload + metadata form
// ------------------------------------------------------------------

interface UploadDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  truckId: string
  tenantId: string
  onSuccess: () => void
}

function UploadDocumentDialog({
  open,
  onOpenChange,
  truckId,
  tenantId,
  onSuccess,
}: UploadDocumentDialogProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [documentType, setDocumentType] = useState<string>('registration')
  const [expiresAt, setExpiresAt] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setDocumentType('registration')
    setExpiresAt('')
    setSelectedFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setSelectedFile(null)
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('File size must not exceed 10MB.')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setError(null)
    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file.')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // 1. Upload file to Supabase Storage
      const { path, error: uploadError } = await uploadFile(
        supabase,
        'documents',
        tenantId,
        truckId,
        selectedFile
      )

      if (uploadError) {
        setError(uploadError)
        return
      }

      // 2. Create document record
      const result = await createDocument('truck', truckId, {
        documentType,
        fileName: selectedFile.name,
        storagePath: path,
        fileSize: selectedFile.size,
        expiresAt: expiresAt || undefined,
      })

      if ('error' in result && result.error) {
        const msg =
          typeof result.error === 'string'
            ? result.error
            : 'Failed to save document record.'
        setError(msg)
        return
      }

      onSuccess()
      handleOpenChange(false)
    } catch {
      setError('An unexpected error occurred during upload.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a document for this truck. Max file size: 10MB.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <Label>Document Type</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="registration">Registration</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="inspection_cert">
                  Inspection Certificate
                </SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Expiration Date (optional)</Label>
            <Input
              type="date"
              className="mt-1.5"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          <div>
            <Label>File</Label>
            <div className="mt-1.5">
              <Input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              {selectedFile && (
                <p className="mt-1 text-xs text-gray-500">
                  {selectedFile.name} (
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <>
                  <Upload className="mr-1.5 h-3.5 w-3.5 animate-pulse" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
