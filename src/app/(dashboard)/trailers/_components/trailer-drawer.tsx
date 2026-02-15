'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { TrailerForm } from './trailer-form'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useState, useCallback } from 'react'
import type { Trailer } from '@/types/database'

interface TrailerDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trailer?: Trailer
}

export function TrailerDrawer({ open, onOpenChange, trailer }: TrailerDrawerProps) {
  const [isDirty, setIsDirty] = useState(false)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)

  const isEdit = !!trailer

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isDirty) {
        setShowUnsavedWarning(true)
        return
      }
      setIsDirty(false)
      onOpenChange(nextOpen)
    },
    [isDirty, onOpenChange]
  )

  const handleSuccess = () => {
    setIsDirty(false)
    onOpenChange(false)
  }

  const handleDiscardConfirm = () => {
    setIsDirty(false)
    setShowUnsavedWarning(false)
    onOpenChange(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{isEdit ? 'Edit Trailer' : 'Add Trailer'}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? `Update details for ${trailer.trailer_number}`
                : 'Add a new trailer to your fleet'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            <TrailerForm
              trailer={trailer}
              onSuccess={handleSuccess}
              onDirtyChange={setIsDirty}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={showUnsavedWarning}
        onOpenChange={setShowUnsavedWarning}
        title="Unsaved changes"
        description="You have unsaved changes. Are you sure you want to close? Your changes will be lost."
        confirmLabel="Discard"
        destructive
        onConfirm={handleDiscardConfirm}
      />
    </>
  )
}
