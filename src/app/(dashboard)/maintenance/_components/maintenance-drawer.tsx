'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { MaintenanceForm } from './maintenance-form'
import { useDraftStore } from '@/stores/draft-store'
import { useQueryClient } from '@tanstack/react-query'
import type { MaintenanceRecord } from '@/types/database'

interface MaintenanceDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: MaintenanceRecord
}

export function MaintenanceDrawer({ open, onOpenChange, record }: MaintenanceDrawerProps) {
  const isEdit = !!record
  const { clearDraft } = useDraftStore()
  const queryClient = useQueryClient()

  const handleSuccess = () => {
    if (!isEdit) {
      clearDraft('maintenance-new')
    }
    queryClient.invalidateQueries({ queryKey: ['maintenance'] })
    queryClient.invalidateQueries({ queryKey: ['maintenance-counts'] })
    if (isEdit && record) {
      queryClient.invalidateQueries({ queryKey: ['maintenance', record.id] })
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
          <SheetTitle>{isEdit ? 'Edit Maintenance Record' : 'Add Maintenance Record'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the maintenance record details.'
              : 'Schedule a new maintenance record. Drafts are saved automatically.'}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <MaintenanceForm
            record={record}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
