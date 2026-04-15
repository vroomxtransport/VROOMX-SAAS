'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Trash2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { addWorkOrderNote, deleteWorkOrderNote } from '@/app/actions/work-orders'
import type { WorkOrderNote } from '@/types/database'

interface WorkOrderNotesProps {
  workOrderId: string
  notes: WorkOrderNote[]
}

export function WorkOrderNotes({ workOrderId, notes }: WorkOrderNotesProps) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [isAdding, startAddTransition] = useTransition()

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return

    startAddTransition(async () => {
      const result = await addWorkOrderNote({ workOrderId, body: trimmed })
      const ok =
        !!result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === true

      if (!ok) {
        const msg =
          result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Failed to add note.'
        toast.error(msg)
        return
      }

      setBody('')
      toast.success('Note added')
      router.refresh()
    })
  }

  return (
    <div className="widget-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Notes</h2>
        {notes.length > 0 && (
          <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {notes.length}
          </span>
        )}
      </div>

      {/* Note list */}
      {notes.length > 0 && (
        <div className="divide-y divide-border">
          {notes.map((note) => (
            <NoteEntry key={note.id} note={note} />
          ))}
        </div>
      )}

      {/* Add note form */}
      <form onSubmit={handleAdd} className="border-t border-border p-4 space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          maxLength={2000}
          className="resize-none text-sm"
          disabled={isAdding}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={isAdding || !body.trim()}
          >
            {isAdding ? 'Adding…' : 'Add Note'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function NoteEntry({ note }: { note: WorkOrderNote }) {
  const router = useRouter()
  const [isDeleting, startDeleteTransition] = useTransition()

  const handleDelete = () => {
    startDeleteTransition(async () => {
      const result = await deleteWorkOrderNote(note.id)
      const ok =
        !!result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === true

      if (!ok) {
        const msg =
          result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Failed to delete note.'
        toast.error(msg)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="group flex gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{note.body}</p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 shrink-0 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label="Delete note"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
