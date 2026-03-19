'use client'

import { useState, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { uploadFile, deleteFile } from '@/lib/storage'
import { sendMessage } from '@/app/actions/chat'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilePreviewStrip } from './file-preview-strip'
import type { ChatMessage, ChatAttachment } from '@/types/database'

const MAX_LENGTH = 5000
const WARN_THRESHOLD = 4500
const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const BUCKET = 'chat-files'

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
  'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt',
])

function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

interface MessageInputProps {
  channelId: string
  channelName?: string
  tenantId: string
}

export function MessageInput({ channelId, channelName, tenantId }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const validateAndAddFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)
    const remaining = MAX_FILES - files.length
    if (remaining <= 0) return

    const valid: File[] = []
    for (const file of fileArray.slice(0, remaining)) {
      if (file.size > MAX_FILE_SIZE) continue
      if (!ALLOWED_EXTENSIONS.has(getFileExtension(file.name))) continue
      valid.push(file)
    }

    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid])
    }
  }, [files.length])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  async function handleSend() {
    const trimmed = content.trim()
    if ((!trimmed && files.length === 0) || sending) return

    setSending(true)
    const supabase = createClient()
    const uploadedPaths: string[] = []

    try {
      // Upload files to storage
      let attachments: ChatAttachment[] | undefined
      if (files.length > 0) {
        attachments = []
        for (let i = 0; i < files.length; i++) {
          setUploadProgress(`Uploading ${i + 1}/${files.length}...`)
          const file = files[i]
          const { path, error } = await uploadFile(supabase, BUCKET, tenantId, channelId, file)
          if (error) {
            // Cleanup already-uploaded files
            for (const p of uploadedPaths) {
              await deleteFile(supabase, BUCKET, p)
            }
            setUploadProgress(null)
            setSending(false)
            return
          }
          uploadedPaths.push(path)
          attachments.push({
            fileName: file.name,
            storagePath: path,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
          })
        }
        setUploadProgress(null)
      }

      // Send message with attachments
      const messageData: { content?: string; attachments?: ChatAttachment[] } = {}
      if (trimmed) messageData.content = trimmed
      if (attachments && attachments.length > 0) messageData.attachments = attachments

      const result = await sendMessage(channelId, messageData)

      if (result && 'data' in result && result.data) {
        queryClient.setQueryData<ChatMessage[]>(
          ['chat-messages', channelId],
          (old) => old ? [...old, result.data as ChatMessage] : [result.data as ChatMessage]
        )
        setContent('')
        setFiles([])
      } else if (result && 'error' in result) {
        // Message insert failed — cleanup uploaded files
        for (const p of uploadedPaths) {
          await deleteFile(supabase, BUCKET, p)
        }
      }
    } catch {
      // Cleanup on unexpected error
      for (const p of uploadedPaths) {
        await deleteFile(createClient(), BUCKET, p)
      }
    } finally {
      setSending(false)
      setUploadProgress(null)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files)
    }
  }, [validateAndAddFiles])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const clipboardFiles = e.clipboardData.files
    if (clipboardFiles.length > 0) {
      e.preventDefault()
      validateAndAddFiles(clipboardFiles)
    }
  }, [validateAndAddFiles])

  const placeholder = channelName
    ? `Message #${channelName}...`
    : 'Type a message...'

  const canSend = (content.trim().length > 0 || files.length > 0) && !sending

  return (
    <div
      className="shrink-0 px-3 pb-3 pt-1 pb-safe"
      role="form"
      aria-label="Message composer"
    >
      <div
        className={cn(
          'glass-panel rounded-xl p-3 transition-colors',
          dragOver && 'ring-2 ring-brand/50 bg-brand/5'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <FilePreviewStrip files={files} onRemove={removeFile} />

        {uploadProgress && (
          <div className="flex items-center gap-2 px-2 pb-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{uploadProgress}</span>
          </div>
        )}

        <div className="relative flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
            onChange={(e) => {
              if (e.target.files) validateAndAddFiles(e.target.files)
              e.target.value = ''
            }}
            className="hidden"
            aria-hidden="true"
          />

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_FILES || sending}
            aria-label="Attach files"
            className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Textarea
            placeholder={placeholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            onPaste={handlePaste}
            disabled={sending}
            enterKeyHint="send"
            maxLength={MAX_LENGTH}
            rows={1}
            className="min-h-[2.5rem] max-h-[7.5rem] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 px-2 py-1.5 text-sm"
            aria-label="Message text"
          />

          <Button
            size="icon"
            onClick={handleSend}
            disabled={!canSend}
            aria-label={sending ? 'Sending message' : 'Send message'}
            className="shrink-0 h-9 w-9 rounded-full bg-brand text-white hover:bg-brand/90 active:scale-95 transition-all disabled:opacity-40"
          >
            {sending && !uploadProgress ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {content.length >= WARN_THRESHOLD && (
          <div className="flex justify-end mt-1 pr-11">
            <span
              className={cn(
                'text-xs tabular-nums',
                content.length >= MAX_LENGTH
                  ? 'text-destructive font-medium'
                  : 'text-muted-foreground'
              )}
              aria-live="polite"
            >
              {content.length}/{MAX_LENGTH}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
