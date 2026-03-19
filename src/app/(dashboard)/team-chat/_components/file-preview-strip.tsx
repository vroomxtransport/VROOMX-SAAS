'use client'

import { useEffect, useState } from 'react'
import { X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FilePreviewStripProps {
  files: File[]
  onRemove: (index: number) => void
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.has(ext)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = isImageFile(file.name)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file, isImage])

  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs max-w-[200px] group">
      {isImage && objectUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={objectUrl}
          alt={file.name}
          className="h-8 w-8 rounded object-cover shrink-0"
        />
      ) : (
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground/80">{file.name}</p>
        <p className="text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        className="shrink-0 opacity-60 hover:opacity-100"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

export function FilePreviewStrip({ files, onRemove }: FilePreviewStripProps) {
  if (files.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-2 pb-2">
      {files.map((file, index) => (
        <FileChip key={`${file.name}-${index}`} file={file} onRemove={() => onRemove(index)} />
      ))}
      <span className="self-center text-xs text-muted-foreground">
        {files.length}/5 files
      </span>
    </div>
  )
}
