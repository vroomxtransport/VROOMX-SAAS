'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { LocalDriveForm } from './local-drive-form'
import { useDraftStore } from '@/stores/draft-store'
import { useQueryClient } from '@tanstack/react-query'
import type { LocalDrive } from '@/types/database'

interface LocalDriveDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  localDrive?: LocalDrive
}

export function LocalDriveDrawer({ open, onOpenChange, localDrive }: LocalDriveDrawerProps) {
  const isEdit = !!localDrive
  const { clearDraft } = useDraftStore()
  const queryClient = useQueryClient()

  const handleSuccess = () => {
    if (!isEdit) {
      clearDraft('local-drive-new')
    }
    queryClient.invalidateQueries({ queryKey: ['local-drives'] })
    if (isEdit && localDrive) {
      queryClient.invalidateQueries({ queryKey: ['local-drive', localDrive.id] })
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
          <SheetTitle>{isEdit ? 'Edit Local Drive' : 'Add Local Drive'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update this local drive transport details.'
              : 'Create a new local drive. Drafts are saved automatically.'}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <LocalDriveForm
            localDrive={localDrive}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
