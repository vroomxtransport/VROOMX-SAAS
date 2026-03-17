'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

interface BulkAction {
  label: string
  icon?: React.ReactNode
  onClick: (selectedIds: string[]) => void
  variant?: 'default' | 'destructive'
}

interface BulkActionBarProps {
  selectedIds: string[]
  totalOnPage: number
  onSelectAll: (checked: boolean) => void
  onClearSelection: () => void
  actions: BulkAction[]
}

export function BulkActionBar({
  selectedIds,
  totalOnPage,
  onSelectAll,
  onClearSelection,
  actions,
}: BulkActionBarProps) {
  const allSelected = selectedIds.length === totalOnPage && totalOnPage > 0
  const someSelected = selectedIds.length > 0

  return (
    <>
      {/* Header checkbox */}
      <div className="flex items-center gap-2">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => onSelectAll(!!checked)}
          aria-label="Select all"
        />
        {someSelected && (
          <span className="text-xs text-muted-foreground">
            {selectedIds.length} selected
          </span>
        )}
      </div>

      {/* Floating action bar */}
      <AnimatePresence>
        {someSelected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-4 py-2.5 shadow-lg">
              <span className="text-sm font-medium text-foreground">
                {selectedIds.length} selected
              </span>
              <div className="mx-2 h-4 w-px bg-border-subtle" />
              {actions.map((action) => (
                <Button
                  key={action.label}
                  size="sm"
                  variant={
                    action.variant === 'destructive' ? 'destructive' : 'outline'
                  }
                  onClick={() => action.onClick(selectedIds)}
                  className="h-8 gap-1.5 text-xs"
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
              <div className="mx-1 h-4 w-px bg-border-subtle" />
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
