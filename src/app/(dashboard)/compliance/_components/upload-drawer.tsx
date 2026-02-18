'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createComplianceDoc, updateComplianceDoc } from '@/app/actions/compliance'
import { uploadFile, deleteFile } from '@/lib/storage'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { COMPLIANCE_DOC_TYPE_LABELS, COMPLIANCE_ENTITY_TYPE_LABELS } from '@/types'
import type { ComplianceDocType, ComplianceEntityType } from '@/types'
import type { ComplianceDocument } from '@/types/database'
import { FileText } from 'lucide-react'

const BUCKET = 'documents'

interface UploadDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc?: ComplianceDocument
}

export function UploadDrawer({ open, onOpenChange, doc }: UploadDrawerProps) {
  const isEdit = !!doc
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [documentType, setDocumentType] = useState<string>(doc?.document_type ?? 'dqf')
  const [entityType, setEntityType] = useState<string>(doc?.entity_type ?? 'driver')
  const [entityId, setEntityId] = useState(doc?.entity_id ?? '')
  const [name, setName] = useState(doc?.name ?? '')
  const [expiresAt, setExpiresAt] = useState(doc?.expires_at?.split('T')[0] ?? '')
  const [notes, setNotes] = useState(doc?.notes ?? '')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { data: drivers } = useDrivers()
  const { data: trucks } = useTrucks()

  useEffect(() => {
    if (open) {
      setDocumentType(doc?.document_type ?? 'dqf')
      setEntityType(doc?.entity_type ?? 'driver')
      setEntityId(doc?.entity_id ?? '')
      setName(doc?.name ?? '')
      setExpiresAt(doc?.expires_at?.split('T')[0] ?? '')
      setNotes(doc?.notes ?? '')
      setSelectedFile(null)
      setUploadError(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [open, doc])

  const handleEntityTypeChange = (value: string) => {
    setEntityType(value)
    if (!isEdit) {
      setEntityId('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setUploadError(null)

    let storagePath = ''
    let fileName = ''
    let fileSize: number | undefined

    // Handle file upload for new documents
    if (!isEdit && selectedFile) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const tenantId = user?.app_metadata?.tenant_id as string | undefined

      if (!tenantId) {
        setUploadError('Unable to determine tenant. Please refresh and try again.')
        setSubmitting(false)
        return
      }

      const uploadEntityId = entityId || 'company'
      const { path, error: uploadErr } = await uploadFile(
        supabase,
        BUCKET,
        tenantId,
        uploadEntityId,
        selectedFile,
      )

      if (uploadErr) {
        setUploadError(uploadErr)
        setSubmitting(false)
        return
      }

      storagePath = path
      fileName = selectedFile.name
      fileSize = selectedFile.size
    }

    const formData = {
      documentType,
      entityType,
      entityId,
      name,
      expiresAt,
      notes,
      ...(storagePath ? { fileName, storagePath, fileSize } : {}),
      // Preserve existing file data on edit
      ...(isEdit && doc?.file_name ? {
        fileName: doc.file_name,
        storagePath: doc.storage_path ?? '',
        fileSize: doc.file_size ?? undefined,
      } : {}),
    }

    const result = isEdit
      ? await updateComplianceDoc(doc.id, formData)
      : await createComplianceDoc(formData)

    if ('error' in result && result.error) {
      // Clean up uploaded file on DB error
      if (storagePath) {
        const supabase = createClient()
        await deleteFile(supabase, BUCKET, storagePath)
      }
      setUploadError(
        typeof result.error === 'string'
          ? result.error
          : 'Failed to save document record',
      )
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    queryClient.invalidateQueries({ queryKey: ['compliance-docs'] })
    queryClient.invalidateQueries({ queryKey: ['compliance-expiration-alerts'] })
    if (isEdit) {
      queryClient.invalidateQueries({ queryKey: ['compliance-doc', doc.id] })
    }
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Document' : 'Upload Document'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the compliance document details.'
              : 'Add a new compliance document to track certifications and expiration dates.'}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="documentType">Document Type</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger id="documentType">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COMPLIANCE_DOC_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entityType">Entity Type</Label>
            <Select value={entityType} onValueChange={handleEntityTypeChange}>
              <SelectTrigger id="entityType">
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COMPLIANCE_ENTITY_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {entityType === 'driver' && (
            <div className="space-y-2">
              <Label htmlFor="entityId">Driver</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger id="entityId">
                  <SelectValue placeholder="Select a driver" />
                </SelectTrigger>
                <SelectContent>
                  {(drivers?.drivers ?? []).map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.first_name} {driver.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {entityType === 'truck' && (
            <div className="space-y-2">
              <Label htmlFor="entityId">Truck</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger id="entityId">
                  <SelectValue placeholder="Select a truck" />
                </SelectTrigger>
                <SelectContent>
                  {(trucks?.trucks ?? []).map((truck) => (
                    <SelectItem key={truck.id} value={truck.id}>
                      #{truck.unit_number}{truck.make ? ` — ${truck.make}` : ''}{truck.model ? ` ${truck.model}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Document Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CDL - John Doe"
              required
            />
          </div>

          {/* File upload — new docs only */}
          {isEdit && doc?.file_name ? (
            <div className="space-y-2">
              <Label>Attached File</Label>
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm text-foreground">{doc.file_name}</span>
              </div>
            </div>
          ) : !isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="fileUpload">File (optional)</Label>
              <Input
                id="fileUpload"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">PDF or image, max 25MB</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="expiresAt">Expiration Date</Label>
            <Input
              id="expiresAt"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
            />
          </div>

          {uploadError && (
            <p className="text-sm text-red-600">{uploadError}</p>
          )}

          <div className="flex items-center gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? (isEdit ? 'Updating...' : 'Uploading...') : isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
