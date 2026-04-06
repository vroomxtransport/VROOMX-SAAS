'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
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
      <FileText className="h-3.5 w-3.5" />
      {exporting ? 'Generating\u2026' : (label ?? 'PDF')}
    </Button>
  )
}
