'use client'

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface CsvExportButtonProps {
  filename: string
  headers: string[]
  fetchData: () => Promise<Record<string, unknown>[]>
  className?: string
}

export function CsvExportButton({
  filename,
  headers,
  fetchData,
  className,
}: CsvExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await fetchData()
      if (data.length === 0) return

      const csvRows = [
        headers.join(','),
        ...data.map((row) =>
          headers
            .map((h) => {
              const val = row[h]
              const str = val === null || val === undefined ? '' : String(val)
              // Escape quotes and wrap in quotes if contains comma/quote/newline
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`
              }
              return str
            })
            .join(',')
        ),
      ]

      const blob = new Blob([csvRows.join('\n')], {
        type: 'text/csv;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
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
      className={cn('h-9 gap-1.5', className)}
    >
      <Download className="h-3.5 w-3.5" />
      {exporting ? 'Exporting...' : 'Export CSV'}
    </Button>
  )
}
