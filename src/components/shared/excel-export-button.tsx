'use client'

import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { FileSpreadsheetIcon } from '@hugeicons/core-free-icons'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { exportToExcel } from '@/lib/export/excel-export'
import type { ExcelColumn } from '@/lib/export/excel-export'

interface ExcelExportButtonProps {
  filename: string
  sheetName?: string
  columns: ExcelColumn[]
  fetchData: () => Promise<Record<string, unknown>[]>
  title?: string
  subtitle?: string
  className?: string
}

export function ExcelExportButton({
  filename,
  sheetName,
  columns,
  fetchData,
  title,
  subtitle,
  className,
}: ExcelExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const rows = await fetchData()
      if (rows.length === 0) return
      exportToExcel({ filename, sheetName, columns, rows, title, subtitle })
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
      <HugeiconsIcon icon={FileSpreadsheetIcon} size={14} />
      {exporting ? 'Exporting...' : 'Excel'}
    </Button>
  )
}
