'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSignedUrl } from '@/lib/storage'
import { FileText, Download, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { ChatAttachment } from '@/types/database'

const BUCKET = 'chat-files'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

function ImageAttachment({ attachment }: { attachment: ChatAttachment }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false
    async function fetchUrl() {
      const { url: signedUrl } = await getSignedUrl(supabase, BUCKET, attachment.storagePath, 3600)
      if (!cancelled && signedUrl) {
        setUrl(signedUrl)
        setLoading(false)
      }
    }
    fetchUrl()
    return () => { cancelled = true }
  }, [supabase, attachment.storagePath])

  const handleClick = useCallback(async () => {
    // Re-fetch signed URL on click in case the cached one expired
    const { url: freshUrl } = await getSignedUrl(supabase, BUCKET, attachment.storagePath, 3600)
    if (freshUrl) window.open(freshUrl, '_blank')
  }, [supabase, attachment.storagePath])

  if (loading) {
    return <Skeleton className="h-40 w-48 rounded-lg" />
  }

  return (
    <button
      onClick={handleClick}
      className="block overflow-hidden rounded-lg border border-border-subtle hover:border-brand/50 transition-colors cursor-pointer"
      title={attachment.fileName}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url ?? ''}
        alt={attachment.fileName}
        className="max-w-xs max-h-48 object-contain rounded-lg"
        loading="lazy"
        onError={(e) => {
          // Hide broken image, show fallback
          (e.target as HTMLImageElement).style.display = 'none'
        }}
      />
    </button>
  )
}

function DocumentAttachment({ attachment }: { attachment: ChatAttachment }) {
  const [downloading, setDownloading] = useState(false)
  const supabase = createClient()

  const handleClick = useCallback(async () => {
    setDownloading(true)
    const { url } = await getSignedUrl(supabase, BUCKET, attachment.storagePath, 3600)
    if (url) window.open(url, '_blank')
    setDownloading(false)
  }, [supabase, attachment.storagePath])

  return (
    <button
      onClick={handleClick}
      disabled={downloading}
      className="inline-flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs hover:bg-muted transition-colors cursor-pointer border border-border-subtle"
      title={`Download ${attachment.fileName}`}
    >
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 text-left">
        <p className="truncate font-medium text-foreground/80 max-w-[160px]">
          {attachment.fileName}
        </p>
        <p className="text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
      </div>
      {downloading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
      ) : (
        <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
    </button>
  )
}

interface AttachmentDisplayProps {
  attachments: ChatAttachment[]
}

export function AttachmentDisplay({ attachments }: AttachmentDisplayProps) {
  if (!attachments || attachments.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((att, i) =>
        isImageMime(att.mimeType) ? (
          <ImageAttachment key={`${att.storagePath}-${i}`} attachment={att} />
        ) : (
          <DocumentAttachment key={`${att.storagePath}-${i}`} attachment={att} />
        )
      )}
    </div>
  )
}
