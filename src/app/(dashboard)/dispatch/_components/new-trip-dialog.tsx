'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface NewTripDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewTripDialog({ open, onOpenChange }: NewTripDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Trip</DialogTitle>
          <DialogDescription>
            Set up a new trip by selecting a truck, driver, and date range.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-gray-500">Loading form...</p>
      </DialogContent>
    </Dialog>
  )
}
