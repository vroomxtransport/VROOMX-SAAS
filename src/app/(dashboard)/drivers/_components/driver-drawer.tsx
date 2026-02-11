'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { DriverForm } from './driver-form'
import { useDraftStore } from '@/stores/draft-store'
import { useQueryClient } from '@tanstack/react-query'
import type { Driver } from '@/types/database'

interface DriverDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  driver?: Driver
}

export function DriverDrawer({ open, onOpenChange, driver }: DriverDrawerProps) {
  const isEdit = !!driver
  const { clearDraft } = useDraftStore()
  const queryClient = useQueryClient()

  const handleSuccess = () => {
    if (!isEdit) {
      clearDraft('driver-new')
    }
    queryClient.invalidateQueries({ queryKey: ['drivers'] })
    if (isEdit && driver) {
      queryClient.invalidateQueries({ queryKey: ['driver', driver.id] })
    }
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Driver' : 'Add Driver'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? `Update ${driver.first_name} ${driver.last_name}'s profile and pay configuration.`
              : 'Add a new driver to your fleet. Drafts are saved automatically.'}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <DriverForm
            driver={driver}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
