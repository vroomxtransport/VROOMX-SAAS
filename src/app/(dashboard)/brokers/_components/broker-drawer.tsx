'use client'

import { useState, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { BrokerForm } from './broker-form'
import { useDraftStore } from '@/stores/draft-store'
import type { Broker } from '@/types/database'

interface BrokerDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  broker?: Broker
}

export function BrokerDrawer({ open, onOpenChange, broker }: BrokerDrawerProps) {
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const { clearDraft, hasDraft } = useDraftStore()
  const isEditMode = !!broker

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && formDirty) {
        setShowDiscardDialog(true)
        return
      }
      onOpenChange(nextOpen)
    },
    [formDirty, onOpenChange]
  )

  const handleDiscard = useCallback(() => {
    if (!isEditMode) {
      clearDraft('broker-new')
    }
    setFormDirty(false)
    setShowDiscardDialog(false)
    onOpenChange(false)
  }, [isEditMode, clearDraft, onOpenChange])

  const handleSuccess = useCallback(() => {
    setFormDirty(false)
    onOpenChange(false)
  }, [onOpenChange])

  const handleCancel = useCallback(() => {
    if (formDirty) {
      setShowDiscardDialog(true)
      return
    }
    onOpenChange(false)
  }, [formDirty, onOpenChange])

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-lg"
          onInteractOutside={(e) => {
            if (formDirty) {
              e.preventDefault()
              setShowDiscardDialog(true)
            }
          }}
        >
          <SheetHeader>
            <SheetTitle>
              {isEditMode ? 'Edit Broker' : 'New Broker'}
            </SheetTitle>
            <SheetDescription>
              {isEditMode
                ? `Update information for ${broker.name}`
                : 'Add a new broker to your directory'}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-4">
            <BrokerFormWrapper
              key={broker?.id ?? 'create'}
              broker={broker}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
              onDirtyChange={setFormDirty}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        title="Discard changes?"
        description="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard"
        destructive
        onConfirm={handleDiscard}
      />
    </>
  )
}

/**
 * Wrapper that tracks dirty state and passes it up to the drawer.
 * Uses key prop to reset form state between create/edit modes.
 */
function BrokerFormWrapper({
  broker,
  onSuccess,
  onCancel,
  onDirtyChange,
}: {
  broker?: Broker
  onSuccess: () => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  return (
    <BrokerFormWithDirtyTracking
      broker={broker}
      onSuccess={onSuccess}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
    />
  )
}

/**
 * Inner component that uses BrokerForm and tracks dirty state via a parent callback.
 * The BrokerForm itself handles react-hook-form; we wrap it to intercept dirty state.
 */
function BrokerFormWithDirtyTracking({
  broker,
  onSuccess,
  onCancel,
  onDirtyChange,
}: {
  broker?: Broker
  onSuccess: () => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  // Track that user interacted with the form.
  // Since BrokerForm handles its own form state, we set dirty=true
  // when user starts interacting (any field changes trigger draft saves).
  const handleSuccess = useCallback(() => {
    onDirtyChange(false)
    onSuccess()
  }, [onDirtyChange, onSuccess])

  // Wrap in a div that catches any change event to set dirty
  return (
    <div
      onChange={() => onDirtyChange(true)}
      onInput={() => onDirtyChange(true)}
    >
      <BrokerForm
        broker={broker}
        onSuccess={handleSuccess}
        onCancel={onCancel}
      />
    </div>
  )
}
