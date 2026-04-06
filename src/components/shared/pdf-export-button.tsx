'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Invoice02Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PdfExportButtonProps {
  onExport: () => Promise<void> | void
  className?: string
  label?: string
}

export function PdfExportButton({ onExport, className, label }: PdfExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      await onExport()
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
      className={cn('gap-1.5', className)}
    >
      <HugeiconsIcon icon={Invoice02Icon} size={14} />
      {exporting ? 'Generating\u2026' : (label ?? 'PDF')}
    </Button>
  )
}
