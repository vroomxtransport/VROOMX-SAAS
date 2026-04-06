'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopyIdButtonProps {
  value: string
  className?: string
}

export function CopyIdButton({ value, className }: CopyIdButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
    },
    [value]
  )

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6 shrink-0 disabled:opacity-100', className)}
            onClick={handleCopy}
            aria-label={copied ? 'Copied' : 'Copy order ID'}
            disabled={copied}
          >
            <div
              className={cn(
                'transition-all',
                copied ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
              )}
            >
              <Check className="h-3.5 w-3.5 stroke-emerald-500" aria-hidden="true" />
            </div>
            <div
              className={cn(
                'absolute transition-all',
                copied ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
              )}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent className="px-2 py-1 text-xs">
          {copied ? 'Copied!' : 'Copy ID'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
