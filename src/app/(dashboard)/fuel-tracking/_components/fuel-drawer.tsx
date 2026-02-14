'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { FuelForm } from './fuel-form'
import { useQueryClient } from '@tanstack/react-query'
import type { FuelEntry } from '@/types/database'

interface FuelDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry?: FuelEntry
}

export function FuelDrawer({ open, onOpenChange, entry }: FuelDrawerProps) {
  const isEdit = !!entry
  const queryClient = useQueryClient()

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['fuel_entries'] })
    queryClient.invalidateQueries({ queryKey: ['fuel_stats'] })
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Fuel Entry' : 'Add Fuel Entry'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update this fuel purchase record.'
              : 'Record a new fuel purchase for your fleet.'}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <FuelForm
            entry={entry}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
