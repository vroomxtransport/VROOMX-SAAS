'use client'

import { useState, useEffect } from 'react'
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
import { useQueryClient } from '@tanstack/react-query'
import { COMPLIANCE_DOC_TYPE_LABELS, COMPLIANCE_ENTITY_TYPE_LABELS } from '@/types'
import type { ComplianceDocType, ComplianceEntityType } from '@/types'
import type { ComplianceDocument } from '@/types/database'

interface UploadDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc?: ComplianceDocument
}

export function UploadDrawer({ open, onOpenChange, doc }: UploadDrawerProps) {
  const isEdit = !!doc
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)

  const [documentType, setDocumentType] = useState<string>(doc?.document_type ?? 'dqf')
  const [entityType, setEntityType] = useState<string>(doc?.entity_type ?? 'driver')
  const [entityId, setEntityId] = useState(doc?.entity_id ?? '')
  const [name, setName] = useState(doc?.name ?? '')
  const [expiresAt, setExpiresAt] = useState(doc?.expires_at?.split('T')[0] ?? '')
  const [notes, setNotes] = useState(doc?.notes ?? '')

  useEffect(() => {
    if (open) {
      setDocumentType(doc?.document_type ?? 'dqf')
      setEntityType(doc?.entity_type ?? 'driver')
      setEntityId(doc?.entity_id ?? '')
      setName(doc?.name ?? '')
      setExpiresAt(doc?.expires_at?.split('T')[0] ?? '')
      setNotes(doc?.notes ?? '')
    }
  }, [open, doc])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const formData = {
      documentType,
      entityType,
      entityId,
      name,
      expiresAt,
      notes,
    }

    const result = isEdit
      ? await updateComplianceDoc(doc.id, formData)
      : await createComplianceDoc(formData)

    setSubmitting(false)

    if ('error' in result && result.error) {
      return
    }

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
            <Select value={entityType} onValueChange={setEntityType}>
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

          {entityType !== 'company' && (
            <div className="space-y-2">
              <Label htmlFor="entityId">
                {COMPLIANCE_ENTITY_TYPE_LABELS[entityType as ComplianceEntityType]} ID
              </Label>
              <Input
                id="entityId"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder={`Enter ${entityType} identifier`}
              />
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

          <div className="flex items-center gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
