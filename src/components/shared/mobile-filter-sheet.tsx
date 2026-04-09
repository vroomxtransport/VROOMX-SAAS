'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { FilterIcon } from '@hugeicons/core-free-icons'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface MobileFilterSheetProps {
  /** Number of currently active filters (shown as badge) */
  activeCount?: number
  /** Filter controls to render inside the sheet */
  children: ReactNode
  /** Called when "Clear All" is tapped */
  onClearAll?: () => void
  /** Optional title override */
  title?: string
  className?: string
}

export function MobileFilterSheet({
  activeCount = 0,
  children,
  onClearAll,
  title = 'Filters',
  className,
}: MobileFilterSheetProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Trigger button — mobile only */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn('relative lg:hidden h-9', className)}
      >
        <HugeiconsIcon icon={FilterIcon} size={16} />
        <span className="ml-1.5">Filters</span>
        {activeCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white leading-none">
            {activeCount}
          </span>
        )}
      </Button>

      {/* Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl flex flex-col pb-[env(safe-area-inset-bottom,0px)]">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-4 px-1">
            {children}
          </div>

          <SheetFooter className="flex-row gap-3 pt-4 border-t border-border mt-4">
            {onClearAll && (
              <Button
                variant="ghost"
                onClick={() => { onClearAll(); setIsOpen(false) }}
                className="flex-1"
              >
                Clear All
              </Button>
            )}
            <Button
              onClick={() => setIsOpen(false)}
              className="flex-1 bg-brand hover:bg-brand/90 text-white"
            >
              Apply
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
