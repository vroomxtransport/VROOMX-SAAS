'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'

interface FabAction {
  label: string
  icon: React.ReactNode
  onClick: () => void
}

interface FabProps {
  /** Primary action when tapped (single-action mode) */
  onClick?: () => void
  /** Primary icon */
  icon: React.ReactNode
  /** Optional label shown on hover/focus */
  label?: string
  /** Speed-dial actions — if provided, tap opens the dial instead of firing onClick */
  actions?: FabAction[]
  className?: string
}

export function Fab({ onClick, icon, label, actions, className }: FabProps) {
  const [isOpen, setIsOpen] = useState(false)
  const hasSpeedDial = actions && actions.length > 0

  const handleClick = () => {
    if (hasSpeedDial) {
      setIsOpen((prev) => !prev)
    } else {
      onClick?.()
    }
  }

  return (
    <div className={cn('fixed bottom-20 right-4 z-40 lg:hidden', className)}>
      {/* Speed-dial actions */}
      <AnimatePresence>
        {isOpen && hasSpeedDial && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[-1]"
              onClick={() => setIsOpen(false)}
            />
            {/* Action buttons */}
            <div className="absolute bottom-16 right-0 flex flex-col-reverse items-end gap-3 pb-2">
              {actions!.map((action, i) => (
                <motion.button
                  key={action.label}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.8 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => { action.onClick(); setIsOpen(false) }}
                  className="flex items-center gap-2"
                >
                  <span className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg">
                    {action.label}
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground shadow-lg ring-1 ring-border">
                    {action.icon}
                  </span>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleClick}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-xl',
          'active:shadow-md transition-shadow',
          isOpen && 'rotate-45'
        )}
        aria-label={label || 'Action'}
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {icon}
        </motion.div>
      </motion.button>
    </div>
  )
}
