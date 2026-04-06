'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { deleteReport } from '@/app/actions/reports'
import type { SavedReport } from '@/lib/reports/report-config'
import {
  Plus, BarChart3, TrendingUp, PieChart, Table2, Activity,
  Trash2, Share2, Clock, Loader2, FileBarChart,
} from 'lucide-react'

const CHART_ICONS: Record<string, React.ElementType> = {
  table: Table2,
  bar: BarChart3,
  line: TrendingUp,
  pie: PieChart,
  area: Activity,
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface ReportsListProps {
  initialReports: SavedReport[]
}

export function ReportsList({ initialReports }: ReportsListProps) {
  const [reports, setReports] = useState(initialReports)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await deleteReport(id)
      if (!('error' in res)) {
        setReports((prev) => prev.filter((r) => r.id !== id))
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (reports.length === 0) {
    return (
      <div className="widget-card flex flex-col items-center justify-center py-20 text-center">
        <FileBarChart className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-base font-medium text-foreground mb-1">No saved reports yet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-[40ch]">
          Create your first custom report to analyze your fleet data
        </p>
        <Link href="/reports/builder">
          <Button className="text-sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Create Report
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/reports/builder">
          <Button className="text-sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New Report
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {reports.map((report) => {
          const ChartIcon = CHART_ICONS[report.config.chartType] ?? BarChart3
          const isDeleting = deletingId === report.id

          return (
            <div
              key={report.id}
              className="widget-card group hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10">
                    <ChartIcon className="h-4.5 w-4.5 text-brand" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground leading-tight">{report.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{report.config.dataSource} data</p>
                  </div>
                </div>
                {report.is_shared && (
                  <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>

              {report.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{report.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(report.updated_at)}
                </span>
                <span>{report.config.metrics.length} metric{report.config.metrics.length !== 1 ? 's' : ''}</span>
                <span className="capitalize">{report.config.chartType}</span>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border-subtle">
                <Link href={`/reports/builder?id=${report.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Open
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(report.id)}
                  disabled={isDeleting}
                  className={cn('text-xs px-2', isDeleting ? '' : 'text-red-500 hover:text-red-600 hover:bg-red-50')}
                >
                  {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
