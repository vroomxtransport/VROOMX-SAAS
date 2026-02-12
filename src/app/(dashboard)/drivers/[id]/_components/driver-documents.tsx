'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchDocuments } from '@/lib/queries/documents'
import { createDocument, deleteDocument } from '@/app/actions/documents'
import { uploadFile, getSignedUrl, deleteFile } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  FileText,
  Upload,
  Download,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import {
  DRIVER_DOCUMENT_TYPES,
  DRIVER_DOCUMENT_TYPE_LABELS,
} from '@/types'
import type { DriverDocumentType } from '@/types'
import type { DriverDocument } from '@/types/database'

interface DriverDocumentsProps {
  driverId: string
  tenantId: string
}

function getExpiryStatus(expiresAt: string | null): {
  label: string
  className: string
} | null {
  if (!expiresAt) return null
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffMs = expiry.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { label: 'Expired', className: 'bg-red-50 text-red-700 border-red-200' }
  }
  if (diffDays <= 30) {
    return {
      label: 'Expiring Soon',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    }
  }
  return null
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const BUCKET = 'documents'

export function DriverDocuments({ driverId, tenantId }: DriverDocumentsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<DriverDocument | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Form state
  const [docType, setDocType] = useState<DriverDocumentType>('cdl')
  const [expiresAt, setExpiresAt] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { data: documents, isLoading } = useQuery({
    queryKey: ['driver-documents', driverId],
    queryFn: () => fetchDocuments(supabase, 'driver', driverId),
    staleTime: 30_000,
  })

  const resetForm = () => {
    setDocType('cdl')
    setExpiresAt('')
    setSelectedFile(null)
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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
        driverId,
        selectedFile
      )

      if (uploadErr) {
        setUploadError(uploadErr)
        setUploading(false)
        return
      }

      // Create document record
      const result = await createDocument('driver', driverId, {
        documentType: docType,
        fileName: selectedFile.name,
        storagePath: path,
        fileSize: selectedFile.size,
        expiresAt: expiresAt || undefined,
      })

      if ('error' in result && result.error) {
        // Clean up uploaded file on DB error
        await deleteFile(supabase, BUCKET, path)
        setUploadError(
          typeof result.error === 'string'
            ? result.error
            : 'Failed to save document record'
        )
        setUploading(false)
        return
      }

      queryClient.invalidateQueries({ queryKey: ['driver-documents', driverId] })
      setUploadOpen(false)
      resetForm()
    } catch (err) {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (doc: DriverDocument) => {
    const { url, error } = await getSignedUrl(supabase, BUCKET, doc.storage_path)
    if (error || !url) return
    window.open(url, '_blank')
  }

  const handleDelete = async () => {
    if (!selectedDoc) return
    await deleteDocument('driver', selectedDoc.id)
    queryClient.invalidateQueries({ queryKey: ['driver-documents', driverId] })
    setDeleteDialogOpen(false)
    setSelectedDoc(null)
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <FileText className="h-4 w-4" />
          Documents
        </h3>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <FileText className="h-4 w-4" />
          Documents
        </h3>
        <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </div>

      {/* Document list */}
      {!documents || documents.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          No documents uploaded yet
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const expiryStatus = getExpiryStatus(doc.expires_at)
            return (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {doc.file_name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {DRIVER_DOCUMENT_TYPE_LABELS[
                          doc.document_type as DriverDocumentType
                        ] ?? doc.document_type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {formatFileSize(doc.file_size)}
                      </span>
                      {doc.expires_at && (
                        <span className="text-xs text-gray-500">
                          Exp: {formatDate(doc.expires_at)}
                        </span>
                      )}
                      {expiryStatus && (
                        <Badge
                          variant="outline"
                          className={expiryStatus.className}
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {expiryStatus.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => {
                      setSelectedDoc(doc)
                      setDeleteDialogOpen(true)
                    }}
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
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="doc-type">Document Type</Label>
              <Select
                value={docType}
                onValueChange={(v) => setDocType(v as DriverDocumentType)}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DRIVER_DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {DRIVER_DOCUMENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="expires-at">Expiration Date (optional)</Label>
              <Input
                id="expires-at"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="file-upload">File</Label>
              <Input
                id="file-upload"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="mt-1"
              />
            </div>

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
            <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Document"
        description={`Are you sure you want to delete "${selectedDoc?.file_name ?? ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
