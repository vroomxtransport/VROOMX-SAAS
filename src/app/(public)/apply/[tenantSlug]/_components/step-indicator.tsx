'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  currentStep: number // 1-indexed
  totalSteps: number
  onStepClick: (step: number) => void
  completedSteps: Set<number> // 1-indexed set of completed steps
}

/**
 * Top tab strip matching the reference screenshots exactly:
 * Page 1 | Page 2 | ... | Page 8
 * - Current page: brand-orange underline
 * - Completed pages: checkmark + clickable
 * - Future pages: gray, not clickable (keyboard tab still accessible but aria-disabled)
 */
export function StepIndicator({
  currentStep,
  totalSteps,
  onStepClick,
  completedSteps,
}: StepIndicatorProps) {
  return (
    <nav
      aria-label="Application progress"
      className="w-full overflow-x-auto"
    >
      <ol
        role="list"
        className="flex items-end gap-0 min-w-max"
      >
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1
          const isCurrent = step === currentStep
          const isCompleted = completedSteps.has(step)
          const isFuture = step > currentStep && !isCompleted

          return (
            <li key={step} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  if (!isFuture) onStepClick(step)
                }}
                disabled={isFuture}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Page ${step}${isCompleted ? ', completed' : isCurrent ? ', current' : ''}`}
                className={cn(
                  'relative flex flex-col items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  // Focus ring uses brand color on dark background
                  'focus-visible:ring-[var(--brand-secondary,#fb7232)]',
                  isFuture
                    ? 'cursor-not-allowed text-white/30'
                    : isCompleted
                      ? 'cursor-pointer text-white/60 hover:text-white/90'
                      : 'cursor-pointer text-white',
                )}
              >
                {/* Label row */}
                <span className="flex items-center gap-1 whitespace-nowrap tracking-wide uppercase text-[11px]">
                  {isCompleted ? (
                    <Check
                      className="h-3 w-3 shrink-0"
                      aria-hidden="true"
                    />
                  ) : null}
                  Page {step}
                </span>

                {/* Underline bar — only visible on current step */}
                <span
                  className={cn(
                    'block h-0.5 w-full rounded-full transition-all duration-200',
                    isCurrent
                      ? 'bg-[var(--brand-secondary,#fb7232)]'
                      : isCompleted
                        ? 'bg-white/20'
                        : 'bg-transparent',
                  )}
                  aria-hidden="true"
                />
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
