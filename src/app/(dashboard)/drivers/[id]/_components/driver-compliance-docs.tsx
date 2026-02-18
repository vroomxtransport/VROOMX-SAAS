'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getSignedUrl } from '@/lib/storage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ShieldCheck, Download, AlertTriangle } from 'lucide-react'
import {
  COMPLIANCE_DOC_TYPE_LABELS,
} from '@/types'
import type { ComplianceDocType } from '@/types'
import type { ComplianceDocument } from '@/types/database'
import { useEffect } from 'react'

const BUCKET = 'documents'

interface DriverComplianceDocsProps {
  driverId: string
}

function getExpiryStatus(expiresAt: string | null): {
  label: string
  className: string
} | null {
  if (!expiresAt) return null
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffMs = expiry.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { label: 'Expired', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800' }
  }
  if (diffDays <= 30) {
    return {
      label: 'Expiring Soon',
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    }
  }
  return null
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function fetchDriverComplianceDocs(
  supabase: ReturnType<typeof createClient>,
  driverId: string,
): Promise<ComplianceDocument[]> {
  const { data, error } = await supabase
    .from('compliance_documents')
    .select('*')
    .eq('entity_type', 'driver')
    .eq('entity_id', driverId)
    .order('expires_at', { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as ComplianceDocument[]
}

export function DriverComplianceDocs({ driverId }: DriverComplianceDocsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const { data: docs, isLoading } = useQuery({
    queryKey: ['driver-compliance-docs', driverId],
    queryFn: () => fetchDriverComplianceDocs(supabase, driverId),
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel(`driver-compliance-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'compliance_documents',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['driver-compliance-docs', driverId] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, driverId])

  const handleDownload = async (doc: ComplianceDocument) => {
    if (!doc.storage_path) return
    setDownloadingId(doc.id)
    const { url, error } = await getSignedUrl(supabase, BUCKET, doc.storage_path)
    setDownloadingId(null)
    if (error || !url) return
    window.open(url, '_blank')
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-surface p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4" />
          Compliance Documents
        </h3>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-surface p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldCheck className="h-4 w-4" />
        Compliance Documents
      </h3>

      {!docs || docs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground/60">
          No compliance documents assigned to this driver
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const expiryStatus = getExpiryStatus(doc.expires_at)
            return (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground/60" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {doc.name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {COMPLIANCE_DOC_TYPE_LABELS[doc.document_type as ComplianceDocType] ?? doc.document_type}
                      </Badge>
                      {doc.file_name && (
                        <span className="truncate text-xs text-muted-foreground">
                          {doc.file_name}
                          {doc.file_size ? ` (${formatFileSize(doc.file_size)})` : ''}
                        </span>
                      )}
                      {doc.expires_at && (
                        <span className="text-xs text-muted-foreground">
                          Exp: {formatDate(doc.expires_at)}
                        </span>
                      )}
                      {expiryStatus && (
                        <Badge variant="outline" className={expiryStatus.className}>
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {expiryStatus.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {doc.storage_path && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
