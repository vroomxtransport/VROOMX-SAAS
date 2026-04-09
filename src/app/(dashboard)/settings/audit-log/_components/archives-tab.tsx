'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { useAuditArchives } from '@/hooks/use-audit-logs'
import { downloadAuditArchive } from '@/app/actions/audit'
import { Archive, Download, Loader2, FileArchive } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatArchiveMonth(archiveMonth: string): string {
  // archiveMonth is expected to be "YYYY-MM" or an ISO date string
  const parts = archiveMonth.slice(0, 7).split('-')
  if (parts.length < 2) return archiveMonth

  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)

  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function DownloadButton({ archiveId }: { archiveId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDownload() {
    setError(null)
    startTransition(async () => {
      const result = await downloadAuditArchive({ archiveId })

      if ('error' in result) {
        setError(result.error as string)
        return
      }

      if (result.success && result.data?.url) {
        const a = document.createElement('a')
        a.href = result.data.url
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        a.click()
      }
    })
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={isPending}
        className="h-8 gap-1.5 text-xs"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        Download
      </Button>
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}

export function ArchivesTab() {
  const { data: archives, isLoading, isError } = useAuditArchives()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface p-6 text-center">
        <p className="text-sm text-red-500">Failed to load archives. Please try again.</p>
      </div>
    )
  }

  if (!archives || archives.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Archive className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No archives yet</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            Monthly archives are created automatically. Logs older than 90 days are archived here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
        <div className="border-b border-border-subtle bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {archives.length} archive{archives.length !== 1 ? 's' : ''} available
          </p>
        </div>

        <div className="divide-y divide-border-subtle">
          {archives.map((archive) => (
            <div
              key={archive.id}
              className={cn(
                'flex items-center gap-4 px-4 py-4',
                'hover:bg-muted/20 transition-colors'
              )}
            >
              {/* Icon */}
              <div className="rounded-lg bg-muted p-2 shrink-0">
                <FileArchive className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Month label */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {formatArchiveMonth(archive.archive_month)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(archive.date_range_start).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  –{' '}
                  {new Date(archive.date_range_end).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>

              {/* Record count */}
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-sm font-medium text-foreground tabular-nums">
                  {archive.record_count.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">records</p>
              </div>

              {/* File size */}
              <div className="text-right shrink-0 hidden md:block">
                <p className="text-sm font-medium text-foreground tabular-nums">
                  {formatFileSize(archive.file_size_bytes)}
                </p>
                <p className="text-xs text-muted-foreground">size</p>
              </div>

              {/* Download */}
              <div className="shrink-0">
                <DownloadButton archiveId={archive.id} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground px-1">
        Archives are compressed and stored securely. Download links expire after 1 hour.
      </p>
    </div>
  )
}
