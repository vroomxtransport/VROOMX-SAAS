'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_TITLES = [
  'Personal Info',
  'FCRA',
  'License',
  'Drug & Alcohol',
  'Safety History',
  'PSP',
  'Clearinghouse',
  'MVR Release',
] as const

interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  onStepClick: (step: number) => void
  completedSteps: Set<number>
}

export function StepIndicator({
  currentStep,
  totalSteps,
  onStepClick,
  completedSteps,
}: StepIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const progressPct = Math.round((completedSteps.size / totalSteps) * 100)
  const currentTitle = PAGE_TITLES[currentStep - 1] ?? `Page ${currentStep}`

  function handleSelect(step: number, isFuture: boolean) {
    if (isFuture) return
    onStepClick(step)
    setIsOpen(false)
  }

  const steps = Array.from({ length: totalSteps }, (_, i) => {
    const step = i + 1
    const isCurrent = step === currentStep
    const isCompleted = completedSteps.has(step)
    const isFuture = step > currentStep && !isCompleted
    const title = PAGE_TITLES[i] ?? `Page ${step}`
    return { step, isCurrent, isCompleted, isFuture, title }
  })

  return (
    <nav aria-label="Application progress" className="relative w-full">
      {/* Desktop pill strip */}
      <ol
        role="list"
        className="hidden sm:flex items-center gap-1 py-2.5 overflow-x-auto"
      >
        {steps.map(({ step, isCurrent, isCompleted, isFuture, title }) => (
          <li key={step} className="shrink-0">
            <button
              type="button"
              onClick={() => handleSelect(step, isFuture)}
              disabled={isFuture}
              aria-current={isCurrent ? 'step' : undefined}
              aria-disabled={isFuture ? 'true' : undefined}
              aria-label={`${title}, step ${step} of ${totalSteps}${isCompleted ? ', completed' : isCurrent ? ', current' : ''}`}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5',
                'text-xs font-medium transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                'focus-visible:ring-[var(--brand-primary,#192334)]',
                isCurrent && [
                  'bg-[var(--brand-primary,#192334)] text-white',
                  'shadow-sm',
                ],
                isCompleted && !isCurrent && [
                  'text-gray-700 cursor-pointer',
                  'hover:bg-gray-200/80 hover:text-gray-900',
                ],
                isFuture && 'text-muted-foreground cursor-not-allowed',
              )}
            >
              {isCompleted && !isCurrent && (
                <Check className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden="true" />
              )}
              <span className="tracking-wide">{title}</span>
            </button>
          </li>
        ))}
      </ol>

      {/* Mobile trigger + dropdown */}
      <div className="sm:hidden py-2">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-controls="step-mobile-panel"
          aria-haspopup="listbox"
          className={cn(
            'flex w-full items-center justify-between rounded-lg px-4 py-2.5',
            'border bg-white text-sm font-medium text-gray-700',
            'transition-colors hover:bg-gray-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)]',
          )}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span
              className="shrink-0 text-xs font-bold tabular-nums"
              style={{ color: 'var(--brand-primary, #192334)' }}
            >
              {currentStep}/{totalSteps}
            </span>
            <span className="truncate">{currentTitle}</span>
          </span>
          <ChevronDown
            className={cn(
              'ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>

        <div
          id="step-mobile-panel"
          role="listbox"
          aria-label="Select a step"
          className={cn(
            'absolute inset-x-0 top-full z-50',
            'border-b border-gray-200 bg-white shadow-lg rounded-b-xl',
            'overflow-hidden transition-all duration-200 ease-out',
            isOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0 pointer-events-none',
          )}
        >
          <ul role="list" className="divide-y divide-gray-100 px-2 py-1.5">
            {steps.map(({ step, isCurrent, isCompleted, isFuture, title }) => (
              <li key={step} role="option" aria-selected={isCurrent}>
                <button
                  type="button"
                  onClick={() => handleSelect(step, isFuture)}
                  disabled={isFuture}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm',
                    'transition-colors duration-100',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-primary,#192334)]',
                    isCurrent && 'font-semibold text-gray-900',
                    isCompleted && !isCurrent && 'text-muted-foreground hover:text-gray-900 cursor-pointer',
                    isFuture && 'text-gray-300 cursor-not-allowed',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      isCurrent && 'text-white',
                      isCompleted && !isCurrent && 'text-emerald-600',
                      isFuture && 'bg-gray-100 text-gray-300',
                    )}
                    style={isCurrent ? { background: 'var(--brand-primary, #192334)' } : undefined}
                    aria-hidden="true"
                  >
                    {isCompleted ? <Check className="h-3 w-3" /> : step}
                  </span>
                  <span className="flex-1 text-left">{title}</span>
                  {isCurrent && (
                    <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" aria-hidden="true">
                      Current
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gray-100" aria-hidden="true">
        <div
          className="h-full transition-[width] duration-500 ease-out rounded-full"
          style={{
            width: `${progressPct}%`,
            background: 'var(--brand-primary, #192334)',
          }}
        />
      </div>
    </nav>
  )
}
