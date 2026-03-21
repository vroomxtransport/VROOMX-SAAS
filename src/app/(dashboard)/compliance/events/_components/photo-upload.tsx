'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { ImagePlus, X, Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const BUCKET = 'safety-photos'
const MAX_PHOTOS = 10
const MAX_SIZE = 25 * 1024 * 1024

export interface PhotoRecord {
  storagePath: string
  fileName: string
  fileSize: number
}

interface PhotoUploadProps {
  tenantId: string
  eventId?: string
  value: PhotoRecord[]
  onChange: (photos: PhotoRecord[]) => void
  disabled?: boolean
}

interface PreviewPhoto {
  file: File
  previewUrl: string
  uploading: boolean
  error: string | null
  record: PhotoRecord | null
}

export function PhotoUpload({ tenantId, eventId, value, onChange, disabled }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<PreviewPhoto[]>([])
  const [globalError, setGlobalError] = useState<string | null>(null)

  const uploadPhoto = async (file: File): Promise<PhotoRecord | null> => {
    if (file.size > MAX_SIZE) {
      setGlobalError(`${file.name} exceeds the 25MB limit.`)
      return null
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const allowedExts = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'])
    if (!allowedExts.has(ext)) {
      setGlobalError(`${file.name} is not a supported image type.`)
      return null
    }

    const supabase = createClient()
    const folder = eventId ? `${tenantId}/safety-events/${eventId}` : `${tenantId}/safety-events/pending`
    const fileName = `${crypto.randomUUID()}.${ext}`
    const storagePath = `${folder}/${fileName}`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { cacheControl: '3600', upsert: false })

    if (error) {
      setGlobalError(`Upload failed: ${error.message}`)
      return null
    }

    return { storagePath, fileName: file.name, fileSize: file.size }
  }

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setGlobalError(null)

    const remaining = MAX_PHOTOS - value.length - previews.filter(p => p.record).length
    const filesToProcess = Array.from(files).slice(0, remaining)

    if (filesToProcess.length === 0) {
      setGlobalError(`Maximum ${MAX_PHOTOS} photos allowed.`)
      return
    }

    // Create previews immediately for optimistic UI
    const newPreviews: PreviewPhoto[] = filesToProcess.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      uploading: true,
      error: null,
      record: null,
    }))

    setPreviews(prev => [...prev, ...newPreviews])

    // Upload each file
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i]
      const record = await uploadPhoto(file)

      setPreviews(prev =>
        prev.map(p =>
          p.file === file
            ? { ...p, uploading: false, record, error: record ? null : 'Upload failed' }
            : p
        )
      )

      if (record) {
        onChange([...value, record])
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeExistingPhoto = (index: number) => {
    const updated = value.filter((_, i) => i !== index)
    onChange(updated)
  }

  const removePreviewPhoto = (file: File) => {
    setPreviews(prev => {
      const preview = prev.find(p => p.file === file)
      if (preview?.previewUrl) URL.revokeObjectURL(preview.previewUrl)
      return prev.filter(p => p.file !== file)
    })
  }

  const totalCount = value.length + previews.filter(p => p.record).length
  const canAddMore = totalCount < MAX_PHOTOS && !disabled

  return (
    <div className="space-y-2">
      <Label>Photos (max {MAX_PHOTOS})</Label>

      {/* Existing saved photos */}
      {(value.length > 0 || previews.length > 0) && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {/* Saved photos (path only — no preview available without signed URL) */}
          {value.map((photo, i) => (
            <div
              key={`saved-${i}`}
              className="group relative aspect-square rounded-lg border border-border-subtle bg-muted/50 flex flex-col items-center justify-center overflow-hidden"
            >
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
              <p className="mt-1 max-w-full truncate px-1 text-[10px] text-muted-foreground text-center">
                {photo.fileName}
              </p>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeExistingPhoto(i)}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove photo"
                >
                  <X className="h-3 w-3 text-destructive" />
                </button>
              )}
            </div>
          ))}

          {/* In-progress previews */}
          {previews.map((preview, i) => (
            <div
              key={`preview-${i}`}
              className={cn(
                'group relative aspect-square rounded-lg border overflow-hidden',
                preview.error ? 'border-destructive bg-destructive/5' : 'border-border-subtle'
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.previewUrl}
                alt={preview.file.name}
                className="h-full w-full object-cover"
              />
              {preview.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                </div>
              )}
              {preview.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
                  <p className="px-1 text-center text-[10px] text-destructive">Failed</p>
                </div>
              )}
              {!preview.uploading && !disabled && (
                <button
                  type="button"
                  onClick={() => removePreviewPhoto(preview.file)}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove photo"
                >
                  <X className="h-3 w-3 text-destructive" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {canAddMore && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic"
            multiple
            className="sr-only"
            id="photo-upload-input"
            onChange={e => handleFilesSelected(e.target.files)}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Add Photos
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            JPEG, PNG, WEBP, HEIC — max 25MB each. {MAX_PHOTOS - totalCount} slot{MAX_PHOTOS - totalCount !== 1 ? 's' : ''} remaining.
          </p>
        </div>
      )}

      {globalError && (
        <p className="text-sm text-destructive">{globalError}</p>
      )}
    </div>
  )
}
