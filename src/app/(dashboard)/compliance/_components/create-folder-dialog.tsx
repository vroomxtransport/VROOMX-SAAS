'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, FolderPlus } from 'lucide-react'
import { createCustomFolder } from '@/app/actions/compliance'

interface CreateFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentType: 'dqf' | 'vehicle_qualification' | 'company_document'
  onSuccess: () => void
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  documentType,
  onSuccess,
}: CreateFolderDialogProps) {
  const [label, setLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state on open
  useEffect(() => {
    if (open) {
      setLabel('')
      setError(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      const result = await createCustomFolder({ documentType, label: label.trim() })
      if ('error' in result && result.error) {
        setError(typeof result.error === 'string' ? result.error : 'Failed to create folder')
        setSubmitting(false)
        return
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <FolderPlus className="h-4 w-4 text-brand" />
            Create Custom Folder
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Add a folder for documents not covered by the predefined FMCSA categories.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Training Records"
              maxLength={80}
              autoFocus
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              This folder will be available for all {documentType === 'dqf' ? 'drivers' : documentType === 'vehicle_qualification' ? 'vehicles' : 'company documents'} in your tenant.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !label.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Folder'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
