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
import { OrderForm } from './order-form'
import { useDraftStore } from '@/stores/draft-store'
import type { OrderWithRelations } from '@/lib/queries/orders'

interface OrderDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order?: OrderWithRelations
}

export function OrderDrawer({ open, onOpenChange, order }: OrderDrawerProps) {
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const { clearDraft } = useDraftStore()
  const isEditMode = !!order

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
      clearDraft('order-new')
    }
    setFormDirty(false)
    setShowDiscardDialog(false)
    setCurrentStep(0)
    onOpenChange(false)
  }, [isEditMode, clearDraft, onOpenChange])

  const handleSuccess = useCallback(() => {
    setFormDirty(false)
    setCurrentStep(0)
    onOpenChange(false)
  }, [onOpenChange])

  const handleCancel = useCallback(() => {
    if (formDirty) {
      setShowDiscardDialog(true)
      return
    }
    setCurrentStep(0)
    onOpenChange(false)
  }, [formDirty, onOpenChange])

  const stepLabel = isEditMode ? 'Edit Order' : `New Order - Step ${currentStep + 1} of 3`

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-2xl"
          onInteractOutside={(e) => {
            if (formDirty) {
              e.preventDefault()
              setShowDiscardDialog(true)
            }
          }}
        >
          <SheetHeader>
            <SheetTitle>{stepLabel}</SheetTitle>
            <SheetDescription>
              {isEditMode
                ? `Update order ${order.order_number ?? order.id.slice(0, 8)}`
                : 'Create a new vehicle transport order'}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-4">
            <div
              key={order?.id ?? 'create'}
              onChange={() => setFormDirty(true)}
              onInput={() => setFormDirty(true)}
            >
              <OrderForm
                order={order}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
                onStepChange={setCurrentStep}
                onDirtyChange={setFormDirty}
              />
            </div>
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
